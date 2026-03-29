const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mandadito: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'delivered', 'completed', 'cancelled'],
      default: 'pending',
    },
    clientConfirmedAt: { type: Date, default: null }, // Cliente confirma que recibió
    mandaditoDeliveredAt: { type: Date, default: null }, // Mandadito marcó como entregado
    amount: { type: Number, default: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);