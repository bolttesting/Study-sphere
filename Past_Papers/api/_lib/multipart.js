const formidable = require('formidable');
const fs = require('fs');

function parseForm(req) {
  const form = formidable({ multiples: false, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getField(fields, key) {
  const value = fields[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function getFile(files, key) {
  const file = files[key];
  if (Array.isArray(file)) return file[0];
  return file;
}

async function readTempFile(file) {
  return fs.promises.readFile(file.filepath);
}

module.exports = { parseForm, getField, getFile, readTempFile };
