const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['client', 'mandadito', 'admin'], required: true },
    
    // Fotos del mandadito
    profilePhoto: { type: String, default: '' },
    motoPhotos: { type: [String], default: [] },
    cedulaPhoto: { type: String, default: '' },
    seguroPhoto: { type: String, default: '' },
    licenciaPhoto: { type: String, default: '' },
    
    // Datos de verificación
    isVerified: { type: Boolean, default: false },
    verificationMessage: { type: String, default: '' },
    
    // NUEVO: Ubicación en tiempo real para seguimiento
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      lastUpdate: { type: Date, default: null }
    },
    isSharingLocation: { type: Boolean, default: false },
    
    credit: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);