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
    motoPhotos: { type: [String], default: [] }, // hasta 2 fotos del vehículo
    cedulaPhoto: { type: String, default: '' },   // foto de cédula
    seguroPhoto: { type: String, default: '' },   // foto del seguro
    licenciaPhoto: { type: String, default: '' }, // foto de licencia de conducir
    
    // Datos de verificación
    isVerified: { type: Boolean, default: false }, // si el admin ha verificado sus documentos
    verificationMessage: { type: String, default: '' },
    
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