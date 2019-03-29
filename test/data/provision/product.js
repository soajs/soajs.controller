let provDb = db.getSiblingDB('core_provision');

/* Tenants */
let files = listFiles('./products');
for (let i = 0; i < files.length; i++) {
    load(files[i].name);
}

provDb.products.drop();

let records = [];
records.push(dsbrdProduct);
provDb.products.insert(records);


/* Indexes for products */
provDb.products.ensureIndex({ code: 1 }, { unique: true });
provDb.products.ensureIndex({ 'packages.code': 1 });