document.getElementById("year").textContent=new Date().getFullYear();
const statusNode=document.getElementById("healthStatus"),checks=document.getElementById("healthChecks"),issues=document.getElementById("schemaIssues");
function statusCard(title,ready,detail){
 const card=document.createElement("article");card.className="health-card";
 const name=document.createElement("strong");name.textContent=title;
 const badge=document.createElement("span");badge.className="health-pill "+(ready?"ready":"missing");badge.textContent=ready?"Ready":"Needs setup";
 const note=document.createElement("small");note.textContent=detail||"";
 card.append(name,badge,note);checks.append(card);
}
async function runCheck(){
 statusNode.textContent="Checking preview environment…";statusNode.classList.remove("is-error");
 checks.replaceChildren();issues.hidden=true;issues.replaceChildren();
 try{
  const response=await fetch("/api/health",{headers:{Accept:"application/json"},cache:"no-store"});
  const data=await response.json();
  statusCard("Cloudflare D1 database",Boolean(data.database),data.database?"D1 binding is responding.":"D1 binding is missing or unreachable.");
  statusCard("Database schema",Boolean(data.schemaReady),data.schemaReady?"Required tables and columns are present.":"Some required tables or columns are missing.");
  statusCard("Cloudinary server configuration",Boolean(data.cloudinaryConfigured),data.cloudinaryConfigured?"Cloudinary variables are present; values remain hidden.":"One or more Cloudinary variables are missing.");
  statusCard("Admin bootstrap secret",Boolean(data.adminBootstrapConfigured),data.adminBootstrapConfigured?"Bootstrap secret is present; value remains hidden.":"ADMIN_BOOTSTRAP_KEY is missing.");
  const problems=[];
  (data.missingTables||[]).forEach(table=>problems.push("Missing table: "+table));
  Object.entries(data.missingColumns||{}).forEach(([table,columns])=>columns.forEach(column=>problems.push("Missing column: "+table+"."+column)));
  if(problems.length){issues.hidden=false;const title=document.createElement("strong");title.textContent="Database items to fix";issues.append(title);const list=document.createElement("ul");problems.forEach(problem=>{const item=document.createElement("li");item.textContent=problem;list.append(item);});issues.append(list);}
  statusNode.textContent=response.ok&&data.schemaReady?"Preview database schema is ready. Check the remaining configuration statuses below.":"Preview setup needs attention. Review the checks below.";
  if(!response.ok)statusNode.classList.add("is-error");
 }catch(err){
  statusNode.textContent="Could not reach /api/health. Confirm Pages Functions deployment and the D1 binding.";
  statusNode.classList.add("is-error");
  statusCard("Health endpoint",false,err.message||"Request failed.");
 }
}
document.getElementById("refreshHealth").addEventListener("click",runCheck);
runCheck();
