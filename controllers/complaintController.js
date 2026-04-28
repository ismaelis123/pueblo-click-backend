const Complaint = require('../models/Complaint');
const nodemailer = require('nodemailer');

// Configurar email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'i37993716@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'tu_contraseña_de_aplicacion'
  }
});

// Crear queja/comentario
const createComplaint = async (req, res) => {
  try {
    const { type, subject, message, mandaditoId, mandaditoName, orderId } = req.body;

    const complaint = await Complaint.create({
      user: req.user._id,
      userName: req.user.name,
      userPhone: req.user.phone,
      userRole: req.user.role,
      type: type || 'queja',
      subject,
      message,
      mandaditoId: mandaditoId || null,
      mandaditoName: mandaditoName || null,
      orderId: orderId || null
    });

    // Enviar email al administrador
    try {
      const emailHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FF6B35, #4361EE); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">📢 Nuevo ${type === 'queja' ? 'Reporte' : type === 'sugerencia' ? 'Sugerencia' : 'Comentario'}</h2>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <p><strong>Tipo:</strong> ${type}</p>
            <p><strong>Asunto:</strong> ${subject}</p>
            <p><strong>De:</strong> ${req.user.name} (${req.user.role === 'client' ? 'Cliente' : 'Mandadito'})</p>
            <p><strong>Teléfono:</strong> ${req.user.phone}</p>
            ${mandaditoName ? `<p><strong>Mandadito reportado:</strong> ${mandaditoName}</p>` : ''}
            <hr style="border: 1px solid #ddd;">
            <p><strong>Mensaje:</strong></p>
            <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #FF6B35;">${message}</p>
            <hr style="border: 1px solid #ddd;">
            <p style="font-size: 12px; color: #999;">Pueblo Click - ${new Date().toLocaleDateString('es-NI')}</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: '"Pueblo Click" <i37993716@gmail.com>',
        to: 'i37993716@gmail.com',
        subject: `[Pueblo Click] ${type.toUpperCase()} - ${subject}`,
        html: emailHTML
      });
      
      console.log('✅ Email enviado al administrador');
    } catch (emailError) {
      console.error('Error enviando email:', emailError);
    }

    res.status(201).json({
      success: true,
      complaint,
      message: type === 'queja' 
        ? '✅ Tu reporte ha sido enviado. Revisaremos el caso.' 
        : '✅ Tu comentario ha sido enviado. ¡Gracias!'
    });
  } catch (error) {
    console.error('Error en createComplaint:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener quejas del usuario
const getUserComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createComplaint, getUserComplaints };