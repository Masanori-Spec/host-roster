import {validateWorkspace,inventory,generate} from './engine.mjs';
self.onmessage=({data})=>{try{const input=validateWorkspace(data.input);const result=data.action==='inventory'?{input,inventory:inventory(input)}:{input,...generate(input)};self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error.message});}};
