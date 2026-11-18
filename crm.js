const $ = id => document.getElementById(id);
let enquiries = [], bookings = [], payments = [];
const rupees = value => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value)||0);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(value,isError=false){$("message").textContent=value;$("message").className=isError?"msg error":"msg";}
async function api(resource,method="GET",body){
  const response=await fetch("/api/admin/crm/"+resource,{method,credentials:"same-origin",headers:body?{"content-type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){location.href="/admin.html";throw new Error("Please sign in to the owner dashboard.");}
  if(!response.ok||!data.success)throw new Error(data.error||"CRM request failed.");
  return data;
}
function table(target,headers,rows,empty){
  const el=$(target);
  if(!rows.length){el.innerHTML='<div class="empty">'+esc(empty)+'</div>';return;}
  el.innerHTML='<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v??"—")+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
}
function setView(name){
  document.querySelectorAll(".view").forEach(el=>el.classList.toggle("hidden",el.id!==name));
  document.querySelectorAll(".nav button").forEach(el=>el.classList.toggle("active",el.dataset.view===name));
}
async function refresh(){
  const [summary,enq,book,pay]=await Promise.all([api("summary"),api("enquiries"),api("bookings"),api("payments")]);
  enquiries=enq.enquiries||[];bookings=book.bookings||[];payments=pay.payments||[];
  $("statEnquiries").textContent=summary.summary.enquiries;
  $("statBookings").textContent=summary.summary.bookings;
  $("statReceived").textContent=rupees(summary.summary.received);
  $("statBalance").textContent=rupees(summary.summary.balance);
  table("recentEnquiries",["Customer","Phone","Event","Date","Status"],enquiries.slice(0,6).map(x=>[x.customer_name,x.phone,x.event_type,x.event_date,x.status]),"No enquiries yet.");
  table("upcomingBookings",["Customer","Event date","Package","Total","Balance"],bookings.filter(x=>x.status!=="cancelled").slice(0,8).map(x=>[x.customer_name,x.event_date,x.package_name,rupees(x.total_amount),rupees(x.balance)]),"No bookings yet.");
  table("enquiryTable",["Customer","Phone","Event","Date","Quote","Status"],enquiries.map(x=>[x.customer_name,x.phone,x.event_type,x.event_date,rupees(x.quoted_amount),x.status]),"No enquiries yet.");
  table("bookingTable",["Customer","Phone","Event date","Package","Total","Received","Balance","Status"],bookings.map(x=>[x.customer_name,x.phone,x.event_date,x.package_name,rupees(x.total_amount),rupees(x.received),rupees(x.balance),x.status]),"No bookings yet.");
  table("paymentTable",["Date","Customer","Event date","Amount","Method","Reference"],payments.map(x=>[x.payment_date,x.customer_name,x.event_date,rupees(x.amount),x.payment_method,x.reference]),"No payments recorded yet.");
  const openEnquiries=enquiries.filter(x=>!["converted","lost"].includes(x.status));
  $("bookEnquiry").innerHTML='<option value="">New booking</option>'+openEnquiries.map(x=>'<option value="'+x.id+'">'+esc(x.customer_name+" · "+x.phone+" · "+x.event_type)+'</option>').join("");
  const activeBookings=bookings.filter(x=>x.status!=="cancelled"&&Number(x.balance)>0);
  $("paymentBooking").innerHTML='<option value="">Select booking</option>'+activeBookings.map(x=>'<option value="'+x.id+'">'+esc(x.customer_name+" · Balance "+rupees(x.balance))+'</option>').join("");
}
function value(id){return $(id).value.trim();}
function formData(prefix){return {
 customerName:value(prefix+"Name"),phone:value(prefix+"Phone"),email:value(prefix+"Email"),
 eventType:value(prefix+"Type"),eventDate:value(prefix+"Date"),venue:value(prefix+"Venue"),
 packageName:value(prefix+"Package")
};}
document.querySelectorAll(".nav button").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.view)));
$("enquiryForm").addEventListener("submit",async e=>{
 e.preventDefault();try{await api("enquiries","POST",{...formData("enq"),quotedAmount:value("enqQuote"),notes:value("enqNotes"),status:"new"});e.target.reset();$("enqQuote").value="0";await refresh();message("Enquiry saved successfully.");}catch(err){message(err.message,true);}
});
$("bookingForm").addEventListener("submit",async e=>{
 e.preventDefault();try{await api("bookings","POST",{...formData("book"),enquiryId:value("bookEnquiry"),totalAmount:value("bookTotal"),advanceAmount:value("bookAdvance"),notes:value("bookNotes"),status:"confirmed",paymentMethod:"cash"});e.target.reset();$("bookAdvance").value="0";await refresh();message("Booking saved successfully.");}catch(err){message(err.message,true);}
});
$("paymentForm").addEventListener("submit",async e=>{
 e.preventDefault();try{await api("payments","POST",{bookingId:value("paymentBooking"),amount:value("paymentAmount"),paymentMethod:value("paymentMethod"),reference:value("paymentRef"),notes:value("paymentNotes")});e.target.reset();await refresh();message("Payment saved successfully.");}catch(err){message(err.message,true);}
});
(async()=>{
 try{
  const me=await fetch("/api/admin/me",{credentials:"same-origin"});
  if(!me.ok){location.href="/admin.html";return;}
  await refresh();
 }catch(err){message(err.message,true);}
})();
