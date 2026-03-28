const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema(
  {
    mandadito: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    reference: { type: String, required: true },
    adminConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deposit', depositSchema);