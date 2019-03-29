let provDb = db.getSiblingDB('core_provision');

/* Tenants */
let files = listFiles('./hosts');
for (let i = 0; i < files.length; i++) {
    load(files[i].name);
}

provDb.hosts.drop();

let records = [];
records.push(urac);
provDb.hosts.insert(records);


/* Indexes for hosts */
provDb.hosts.ensureIndex({env: 1});
provDb.hosts.ensureIndex({'name': 1});