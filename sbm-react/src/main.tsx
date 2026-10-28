// Build entry (sbm.js, loaded by jms/www/sbm.html with ?v=<build>). It only loads
// the app as a hashed chunk: lazy pages then import that chunk, never sbm.js
// itself, so the app cannot load twice (sbm.js?v=1 and sbm.js are different
// modules to the browser) and each new build gets new file names.

void import("./start");
