const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    userName: { 
      type: String, 
      required: true 
    },
    userPhone: { 
      type: String, 
      required: true 
    },
    userRole: { 
      type: String, 
      enum: ['client', 'mandadito'], 
      required: true 
    },
    type: {
      type: String,
      enum: ['queja', 'sugerencia', 'ayuda', 'otro'],
      default: 'queja'
    },
    subject: { 
      type: String, 
      required: true 
    },
    message: { 
      type: String, 
      required: true 
    },
    mandaditoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    mandaditoName: {
      type: String,
      default: null
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    status: {
      type: String,
      enum: ['pendiente', 'revisado', 'resuelto'],
      default: 'pendiente'
    },
    adminResponse: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);