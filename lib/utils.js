const when = (condition, value) => {
  return condition ? [value] : [];
};

module.exports = { when };
