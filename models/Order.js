const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    client: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    mandadito: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      default: null 
    },
    description: { 
      type: String, 
      required: true 
    },
    pickupAddress: { 
      type: String, 
      required: true 
    },
    deliveryAddress: { 
      type: String, 
      required: true 
    },
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
    // NUEVO: Sistema de tarifas
    amount: { 
      type: Number, 
      default: null  // null = se calculará automáticamente
    },
    isUrgent: {
      type: Boolean,
      default: false
    },
    customPrice: {
      type: Number,
      default: null  // Solo se usa si isUrgent = true
    },
    distance: {
      type: Number,  // en kilómetros
      default: null
    },
    estimatedTime: {
      type: Number,  // en minutos
      default: null
    },
    // Campos existentes
    clientConfirmedAt: { 
      type: Date, 
      default: null 
    },
    mandaditoDeliveredAt: { 
      type: Date, 
      default: null 
    }
  },
  { timestamps: true }
);

// Método para calcular tarifa según distancia
orderSchema.methods.calculateFare = function(distanceKm) {
  if (this.isUrgent && this.customPrice) {
    return this.customPrice;
  }
  
  if (distanceKm <= 2) {
    return 30;  // Cerca: C$30
  } else if (distanceKm <= 5) {
    return 40;  // Moderado: C$40
  } else if (distanceKm <= 8) {
    return 50;  // Largo: C$50
  } else {
    return 60;  // Muy largo: C$60
  }
};

module.exports = mongoose.model('Order', orderSchema);