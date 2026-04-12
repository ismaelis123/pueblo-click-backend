const webpush = require('web-push');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

// Obtener VAPID keys de las variables de entorno
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

console.log('🔐 Configurando VAPID keys...');
console.log('Public Key existe:', !!publicKey);
console.log('Private Key existe:', !!privateKey);

// Solo configurar si ambas keys existen
if (publicKey && privateKey && publicKey !== 'undefined' && privateKey !== 'undefined') {
  try {
    webpush.setVapidDetails(
      'mailto:soporte@puebloclick.com',
      publicKey,
      privateKey
    );
    console.log('✅ VAPID keys configuradas correctamente');
  } catch (error) {
    console.error('❌ Error configurando VAPID keys:', error.message);
  }
} else {
  console.log('⚠️ VAPID keys no configuradas. Las notificaciones push no funcionarán.');
}

const saveSubscription = async (req, res) => {
  try {
    const { subscription, device } = req.body;
    
    let existing = await Subscription.findOne({ 
      userId: req.user._id, 
      'subscription.endpoint': subscription.endpoint 
    });
    
    if (existing) {
      existing.subscription = subscription;
      existing.device = device;
      await existing.save();
    } else {
      await Subscription.create({
        userId: req.user._id,
        subscription,
        device
      });
    }
    
    res.json({ message: '✅ Suscripción guardada correctamente' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteSubscription = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await Subscription.deleteOne({ 
      userId: req.user._id, 
      'subscription.endpoint': endpoint 
    });
    res.json({ message: '✅ Suscripción eliminada' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendPushNotification = async (userId, title, body, url = '/') => {
  if (!publicKey || !privateKey || publicKey === 'undefined' || privateKey === 'undefined') {
    console.log('⚠️ Notificación no enviada: VAPID keys no configuradas');
    return;
  }
  
  try {
    const subscriptions = await Subscription.find({ userId });
    if (subscriptions.length === 0) return;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      data: { url }
    });
    
    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub.subscription, payload))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error enviando a ${subscriptions[index]._id}:`, result.reason);
      }
    });
  } catch (error) {
    console.error('Error enviando notificación:', error);
  }
};

const notifyNewOrderToMandaditos = async (order, clientName) => {
  try {
    const mandaditos = await User.find({ 
      role: 'mandadito', 
      isAvailable: true, 
      isActive: true,
      isVerified: true 
    });
    
    console.log(`📢 Notificando a ${mandaditos.length} mandaditos sobre nuevo mandado`);
    
    for (const mandadito of mandaditos) {
      await sendPushNotification(
        mandadito._id,
        '📦 Nuevo mandado disponible',
        `${clientName} necesita un mandado: ${order.description.substring(0, 50)}...`,
        '/mandadito/pending'
      );
    }
  } catch (error) {
    console.error('Error notificando mandaditos:', error);
  }
};

// ==================== FUNCIONES FALTANTES (AGREGADAS) ====================

const notifyOrderAccepted = async (order, mandaditoName) => {
  await sendPushNotification(
    order.client,
    '✅ Mandado aceptado',
    `Tu mandado ha sido aceptado por ${mandaditoName}. Está en camino.`,
    `/client/track/${order._id}`
  );
};

const notifyOrderDelivered = async (order, mandaditoName) => {
  await sendPushNotification(
    order.client,
    '📦 Mandado entregado',
    `${mandaditoName} ha marcado tu mandado como entregado. Por favor confirma la recepción.`,
    `/client/orders`
  );
};

const notifyClientConfirmed = async (order, clientName) => {
  await sendPushNotification(
    order.mandadito,
    '✅ Cliente confirmó la entrega',
    `${clientName} confirmó que recibió el mandado. ¡Gracias por tu servicio!`,
    `/mandadito/orders`
  );
};

module.exports = {
  saveSubscription,
  deleteSubscription,
  sendPushNotification,
  notifyNewOrderToMandaditos,
  notifyOrderAccepted,
  notifyOrderDelivered,
  notifyClientConfirmed
};