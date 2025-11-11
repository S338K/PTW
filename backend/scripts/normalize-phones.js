#!/usr/bin/env node
/*
  Script: normalize-phones.js
  - Connects to MongoDB and normalizes phone/mobile fields for User, Admin, Approver collections
  - Removes spaces, hyphens, parentheses and saves cleaned canonical value
  - Reports records that still don't match the canonical +974\d{8,} pattern

  Usage: node backend/scripts/normalize-phones.js
*/

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/user');
const Admin = require('../models/admin');
const Approver = require('../models/approver');
const logger = require('../logger');

const phoneRe = /^\+974\d{8,}$/;

async function normalizePhone(value) {
  if (!value) return '';
  return String(value).replace(/[\s\-()]/g, '');
}

async function processModel(Model, fieldName = 'phone') {
  const results = { updated: 0, failed: [] };
  const cursor = Model.find().cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      const raw = String(doc[fieldName] || '');
      const cleaned = await normalizePhone(raw);
      if (!cleaned) continue; // nothing to do
      if (phoneRe.test(cleaned)) {
        if (cleaned !== raw) {
          doc[fieldName] = cleaned;
          await doc.save();
          results.updated++;
        }
      } else {
        results.failed.push({ id: doc._id.toString(), raw, cleaned });
      }
    } catch (e) {
      results.failed.push({ id: doc && doc._id ? doc._id.toString() : '?', error: e.message });
    }
  }
  return results;
}

async function run() {
  const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017';
  await mongoose.connect(MONGO, { dbName: process.env.MONGO_DB || 'PTW' });
  logger.info('Connected to Mongo for phone normalization');

  logger.info('Processing Users (phone)...');
  const uRes = await processModel(User, 'phone');
  logger.info({ updated: uRes.updated, failures: uRes.failed.length }, 'Users processed');
  if (uRes.failed.length) logger.info({ sampleFailures: uRes.failed.slice(0, 20) });

  logger.info('Processing Admins (mobile)...');
  const aRes = await processModel(Admin, 'mobile');
  logger.info({ updated: aRes.updated, failures: aRes.failed.length }, 'Admins processed');
  if (aRes.failed.length) logger.info({ sampleFailures: aRes.failed.slice(0, 20) });

  logger.info('Processing Approvers (mobile)...');
  const apRes = await processModel(Approver, 'mobile');
  logger.info({ updated: apRes.updated, failures: apRes.failed.length }, 'Approvers processed');
  if (apRes.failed.length) logger.info({ sampleFailures: apRes.failed.slice(0, 20) });

  await mongoose.disconnect();
  logger.info('Phone normalization complete');
  process.exit(0);
}

run().catch((e) => {
  logger.error({ err: e }, 'normalize-phones error');
  process.exit(2);
});
