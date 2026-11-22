'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
test('Pages uploads exactly one named artifact then waits for API indexing before deploy-pages',()=>{
 const upload=workflow.indexOf('uses: actions/upload-pages-artifact@v4');
 const visibility=workflow.indexOf('Wait until Pages artifact is visible to Actions API');
 const deploy=workflow.indexOf('uses: actions/deploy-pages@v4');
 assert(upload>=0&&visibility>upload&&deploy>visibility);
 assert.match(workflow,/actions\/runs\/\$\{GITHUB_RUN_ID\}\/artifacts/);
 assert.match(workflow,/a\.name==='github-pages'/);
 assert.match(workflow,/if \[ "\$count" = 1 \]; then/);
 assert.match(workflow,/Multiple github-pages artifacts detected/);
});
test('release HTML verification remains downstream of successful Pages deployment',()=>{
 assert(workflow.indexOf('Verify actual published Pages release')>workflow.indexOf('uses: actions/deploy-pages@v4'));
 assert.match(workflow,/cloud-opacity/);
 assert.match(workflow,/data-app-version/);
});
