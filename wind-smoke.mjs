/* Live DWD ICON wind-vector model metadata smoke test for GitHub Actions.
 * No GPS or private coordinates. The browser accesses this same public feed. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildWindFrames,metadataUrl}=require('./wind-core.js');
const abort=new AbortController();
const timeout=setTimeout(()=>abort.abort(),20000);
try{
 const response=await fetch(metadataUrl(),{signal:abort.signal,cache:'no-store'});
 if(!response.ok)throw Error('Wind model metadata HTTP '+response.status);
 const metadata=await response.json();
 const result=buildWindFrames(metadata,new Date(),48,3);
 if(result.frames.length<8)throw Error('Insufficient wind forecast hours for animation');
 const end=result.frames.at(-1).epoch-Date.now();
 if(end<30*3600000)throw Error('Wind model future coverage below 30 hours');
 console.log('DWD ICON wind vectors confirmed: '+result.frames.length+
   ' forecast frames, last '+Math.round(end/3600000)+' hours ahead, '+
   'both u/v 10 m model components available.');
}finally{clearTimeout(timeout);}
