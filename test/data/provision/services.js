let provDb = db.getSiblingDB('core_provision');

/* Tenants */
let files = listFiles('./services');
for (let i = 0; i < files.length; i++) {
    load(files[i].name);
}

provDb.services.drop();

let records = [];
records.push(urac);
provDb.services.insert(records);

/* Indexes for services */
provDb.services.ensureIndex({name: 1}, {unique: true});
provDb.services.ensureIndex({'port': 1}, {unique: true});
provDb.services.ensureIndex({'extKeyRequired': 1});