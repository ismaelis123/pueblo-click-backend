const imageToBase64 = (file) => {
  if (!file) return '';
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
};

module.exports = imageToBase64;