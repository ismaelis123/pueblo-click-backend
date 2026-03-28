module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🟢 Cliente conectado:', socket.id);

    socket.on('register', (userId) => {
      socket.userId = userId;
      socket.join(userId);
      console.log(`📱 Usuario ${userId} registrado`);
    });

    socket.on('disconnect', () => {
      console.log('🔴 Cliente desconectado:', socket.id);
    });
  });
};