let provDb = db.getSiblingDB('core_provision');

/* Tenants */
let files = listFiles('./tenants');
for (let i = 0; i < files.length; i++) {
    load(files[i].name);
}

provDb.tenants.drop();

let records = [];
records.push(console);
provDb.tenants.insert(records);


/* Indexes for tenants */
provDb.tenants.ensureIndex({ code: 1 }, { unique: true });
provDb.tenants.ensureIndex({ 'applications.appId': 1 } );
provDb.tenants.ensureIndex({ 'applications.keys.key': 1 } );