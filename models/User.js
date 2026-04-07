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
    
    // Horario de trabajo del mandadito
    workSchedule: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '08:00' },
      endTime: { type: String, default: '17:00' },
      lunchStart: { type: String, default: '12:00' },
      lunchEnd: { type: String, default: '13:00' },
      workDays: {
        monday: { type: Boolean, default: true },
        tuesday: { type: Boolean, default: true },
        wednesday: { type: Boolean, default: true },
        thursday: { type: Boolean, default: true },
        friday: { type: Boolean, default: true },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false }
      }
    },
    
    // Ubicación en tiempo real
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

// Encriptar password antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Método para verificar si está en horario laboral
userSchema.methods.isWithinWorkHours = function() {
  if (!this.workSchedule.enabled) return true;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  if (!this.workSchedule.workDays[currentDay]) return false;
  
  const [startHour, startMinute] = this.workSchedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = this.workSchedule.endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  
  if (currentTime < startTotal || currentTime > endTotal) return false;
  
  const [lunchStartHour, lunchStartMinute] = this.workSchedule.lunchStart.split(':').map(Number);
  const [lunchEndHour, lunchEndMinute] = this.workSchedule.lunchEnd.split(':').map(Number);
  const lunchStartTotal = lunchStartHour * 60 + lunchStartMinute;
  const lunchEndTotal = lunchEndHour * 60 + lunchEndMinute;
  
  if (currentTime >= lunchStartTotal && currentTime <= lunchEndTotal) return false;
  
  return true;
};

// Método para actualizar disponibilidad automática
userSchema.methods.updateAvailability = async function() {
  if (!this.workSchedule.enabled) return this.isAvailable;
  const inWorkHours = this.isWithinWorkHours();
  if (this.isAvailable !== inWorkHours) {
    this.isAvailable = inWorkHours;
    await this.save();
  }
  return this.isAvailable;
};

module.exports = mongoose.model('User', userSchema);