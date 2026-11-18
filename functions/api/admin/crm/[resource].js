import { json, error, readJson, text, isSameOriginRequest } from "../../../_lib/http.js";
import { authenticateAdmin } from "../../../_lib/auth.js";

const resources = new Set(["summary", "enquiries", "bookings", "payments"]);
const statuses = {
  enquiries: new Set(["new", "contacted", "follow_up", "quoted", "converted", "lost"]),
  bookings: new Set(["tentative", "confirmed", "completed", "cancelled"])
};
const number = value => Number.isFinite(Number(value)) ? Number(value) : NaN;
const money = value => Math.round(number(value) * 100) / 100;

async function owner(request, env) {
  return authenticateAdmin(request, env);
}
function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet({ request, env, params }) {
  const admin = await owner(request, env);
  if (!admin) return error("Not signed in.", 401);
  const resource = String(params.resource || "");
  if (!resources.has(resource)) return error("Unknown CRM section.", 404);
  try {
    if (resource === "summary") {
      const [enquiries, bookings, payments] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status NOT IN ('converted','lost') THEN 1 ELSE 0 END) AS open FROM crm_enquiries WHERE admin_id=?").bind(admin.id).first(),
        env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(total_amount),0) AS value FROM crm_bookings WHERE admin_id=? AND status!='cancelled'").bind(admin.id).first(),
        env.DB.prepare("SELECT COALESCE(SUM(p.amount),0) AS received FROM crm_payments p JOIN crm_bookings b ON b.id=p.booking_id AND b.admin_id=p.admin_id WHERE p.admin_id=? AND b.status!='cancelled'").bind(admin.id).first()
      ]);
      const received = money(payments?.received || 0);
      const booked = money(bookings?.value || 0);
      return json({ success: true, summary: {
        enquiries: Number(enquiries?.total || 0),
        openEnquiries: Number(enquiries?.open || 0),
        bookings: Number(bookings?.total || 0),
        bookedValue: booked,
        received,
        balance: money(booked - received)
      }});
    }
    if (resource === "enquiries") {
      const rows = await env.DB.prepare(
        "SELECT id,customer_name,phone,email,event_type,event_date,venue,package_name,quoted_amount,source,status,notes,created_at,updated_at FROM crm_enquiries WHERE admin_id=? ORDER BY created_at DESC LIMIT 200"
      ).bind(admin.id).all();
      return json({ success: true, enquiries: rows.results || [] });
    }
    if (resource === "bookings") {
      const rows = await env.DB.prepare(
        "SELECT b.id,b.enquiry_id,b.event_id,b.customer_name,b.phone,b.email,b.event_type,b.event_date,b.venue,b.package_name,b.total_amount,b.advance_amount,b.status,b.notes,b.created_at,COALESCE((SELECT SUM(p.amount) FROM crm_payments p WHERE p.booking_id=b.id AND p.admin_id=b.admin_id),0) AS received FROM crm_bookings b WHERE b.admin_id=? ORDER BY b.event_date IS NULL,b.event_date ASC,b.created_at DESC LIMIT 200"
      ).bind(admin.id).all();
      return json({ success: true, bookings: (rows.results || []).map(row => ({ ...row, balance: money(Number(row.total_amount) - Number(row.received)) })) });
    }
    const rows = await env.DB.prepare(
      "SELECT p.id,p.booking_id,p.amount,p.payment_date,p.payment_method,p.reference,p.notes,b.customer_name,b.event_date FROM crm_payments p JOIN crm_bookings b ON b.id=p.booking_id AND b.admin_id=p.admin_id WHERE p.admin_id=? ORDER BY p.payment_date DESC,p.id DESC LIMIT 300"
    ).bind(admin.id).all();
    return json({ success: true, payments: rows.results || [] });
  } catch (err) {
    return error(err.message || "Could not load CRM records. Confirm the CRM migration has been applied to this database.", 503);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin = await owner(request, env);
  if (!admin) return error("Not signed in.", 401);
  const resource = String(params.resource || "");
  if (!["enquiries", "bookings", "payments"].includes(resource)) return error("Unknown CRM section.", 404);
  try {
    const input = await readJson(request);
    const customerName = text(input.customerName, 120);
    const phone = text(input.phone, 30);
    const email = text(input.email, 180).toLowerCase() || null;
    const eventType = text(input.eventType, 30).toLowerCase() || "other";
    const eventDate = text(input.eventDate, 20) || null;
    const venue = text(input.venue, 180) || null;
    const packageName = text(input.packageName, 120) || null;
    const notes = text(input.notes, 2000) || null;
    if (resource !== "payments" && (!customerName || !phone)) return error("Customer name and phone are required.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid email address.");

    if (resource === "enquiries") {
      const quoted = input.quotedAmount === "" || input.quotedAmount == null ? 0 : money(input.quotedAmount);
      const status = text(input.status, 20) || "new";
      if (!Number.isFinite(quoted) || quoted < 0 || !statuses.enquiries.has(status)) return error("Check the quotation amount and enquiry status.");
      const result = await env.DB.prepare(
        "INSERT INTO crm_enquiries (admin_id,customer_name,phone,email,event_type,event_date,venue,package_name,quoted_amount,source,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(admin.id,customerName,phone,email,eventType,eventDate,venue,packageName,quoted,text(input.source,80)||null,status,notes).run();
      return json({ success: true, id: result.meta.last_row_id }, 201);
    }

    if (resource === "bookings") {
      const total = money(input.totalAmount), advance = input.advanceAmount === "" || input.advanceAmount == null ? 0 : money(input.advanceAmount);
      const enquiryId = input.enquiryId ? validId(input.enquiryId) : null;
      const status = text(input.status, 20) || "confirmed";
      if (!Number.isFinite(total) || total < 0 || !Number.isFinite(advance) || advance < 0 || advance > total || !statuses.bookings.has(status)) return error("Check the booking amount, advance and status.");
      if (input.enquiryId && !enquiryId) return error("Invalid enquiry.");
      if (enquiryId) {
        const enquiry = await env.DB.prepare("SELECT id,status FROM crm_enquiries WHERE id=? AND admin_id=?").bind(enquiryId,admin.id).first();
        if (!enquiry) return error("Enquiry not found.",404);
        if (["converted","lost"].includes(enquiry.status)) return error("This enquiry is already closed and cannot be converted into another booking.",409);
      }
      const result = await env.DB.prepare(
        "INSERT INTO crm_bookings (admin_id,enquiry_id,customer_name,phone,email,event_type,event_date,venue,package_name,total_amount,advance_amount,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(admin.id,enquiryId,customerName,phone,email,eventType,eventDate,venue,packageName,total,advance,status,notes).run();
      if (enquiryId) await env.DB.prepare("UPDATE crm_enquiries SET status='converted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND admin_id=?").bind(enquiryId,admin.id).run();
      if (advance > 0) {
        await env.DB.prepare("INSERT INTO crm_payments (admin_id,booking_id,amount,payment_method,notes) VALUES (?,?,?,?,?)")
          .bind(admin.id,result.meta.last_row_id,advance,text(input.paymentMethod,30)||"cash","Advance payment recorded while creating booking").run();
      }
      return json({ success: true, id: result.meta.last_row_id }, 201);
    }

    const bookingId = validId(input.bookingId);
    const amount = money(input.amount);
    const method = text(input.paymentMethod, 30) || "cash";
    if (!bookingId || !Number.isFinite(amount) || amount <= 0) return error("Choose a booking and enter a payment amount greater than zero.");
    const booking = await env.DB.prepare("SELECT id,total_amount,status FROM crm_bookings WHERE id=? AND admin_id=?").bind(bookingId,admin.id).first();
    if (!booking || booking.status === "cancelled") return error("Active booking not found.",404);
    const already = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS received FROM crm_payments WHERE booking_id=? AND admin_id=?").bind(bookingId,admin.id).first();
    if (money(Number(already?.received || 0) + amount) > money(booking.total_amount)) return error("Payment exceeds the remaining booking balance.");
    const result = await env.DB.prepare(
      "INSERT INTO crm_payments (admin_id,booking_id,amount,payment_method,reference,notes) VALUES (?,?,?,?,?,?)"
    ).bind(admin.id,bookingId,amount,method,text(input.reference,120)||null,notes).run();
    return json({ success: true, id: result.meta.last_row_id }, 201);
  } catch (err) {
    return error(err.message || "Could not save CRM record. Confirm the CRM migration has been applied to this database.", 503);
  }
}
