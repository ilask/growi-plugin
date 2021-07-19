module.exports = function(crowi, app) {
  const { /* appService, */ mailService } = crowi;
  const path = require('path');
  const actions = {};
  const api = {};
  actions.api = api;

  actions.forgotPassword = async function(req, res) {
    return res.render('forgot-password');
  };


  async function sendPasswordResetEmail(i18n) {

    return mailService.send({
      to: 'hoge@gmail.com',
      subject: 'forgotPasswordMailTest',
      template: path.join(crowi.localeDir, `${i18n}/notifications/passwordReset.txt`),
      // TODO: need to set appropriate values by GW-6828
      // vars: {
      //   appTitle: appService.getAppTitle(),
      //   email: 'hoge@gmail.com',
      //   url: 'https://www.google.com/',
      // },
    });
  }

  api.post = async function(req, res) {
    const i18n = req.language;
    await sendPasswordResetEmail(i18n);
    return;
  };


  return actions;
};
