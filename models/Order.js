const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mandadito: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    pickupLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    deliveryLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    status: {
      type: String,
      enum: ['pending', 'pending_confirmation', 'accepted', 'delivered', 'completed', 'cancelled'],
      default: 'pending'
    },
    amount: { type: Number, default: 30 },
    isUrgent: { type: Boolean, default: false },
    distance: { type: Number, default: null },
    clientConfirmedAt: { type: Date, default: null },
    mandaditoDeliveredAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);