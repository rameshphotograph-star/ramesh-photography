import {json,currentUser} from "../../_lib/auth.js";
export async function onRequestGet({request,env}){const user=await currentUser(request,env);return user?json({authenticated:true,user}):json({authenticated:false},401)}
