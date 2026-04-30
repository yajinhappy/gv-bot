const fs = require('fs');
const path = require('path');

const targetDir = 'c:\\Users\\YejinHwang\\Documents\\황예진\\260424 디스코드\\admin-tool';

const filesToProcess = [
  'index.html',
  'title_settings.html',
  'operator_mgmt.html',
  'activity_log.html',
  'message_detail.html',
  'message_write.html',
  'mypage.html',
  'password_change.html'
];

filesToProcess.forEach(file => {
  const filePath = path.join(targetDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - Not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Sidebar replacement
  // Replace from <aside class="sidebar"> to </aside>
  const sidebarRegex = /<aside class="sidebar">[\s\S]*?<\/aside>/i;
  
  if (sidebarRegex.test(content)) {
    content = content.replace(sidebarRegex, '<!-- LNB (Sidebar) - 공통 모듈 -->\n    <aside id="lnb"></aside>');
    console.log(`Replaced sidebar in ${file}`);
  } else {
    console.log(`Sidebar not found in ${file}`);
  }

  // Inject script
  // Replace <script src="api-client.js"></script> with <script src="lnb.js"></script>\n  <script src="api-client.js"></script>
  if (!content.includes('<script src="lnb.js"></script>')) {
    if (content.includes('<script src="api-client.js"></script>')) {
      content = content.replace('<script src="api-client.js"></script>', '<script src="lnb.js"></script>\n  <script src="api-client.js"></script>');
      console.log(`Injected lnb.js in ${file}`);
    } else if (content.includes('<script src="script.js"></script>')) {
      content = content.replace('<script src="script.js"></script>', '<script src="lnb.js"></script>\n  <script src="script.js"></script>');
      console.log(`Injected lnb.js in ${file} (fallback)`);
    } else {
      content = content.replace('</body>', '  <script src="lnb.js"></script>\n</body>');
      console.log(`Injected lnb.js in ${file} (before body)`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done.');
