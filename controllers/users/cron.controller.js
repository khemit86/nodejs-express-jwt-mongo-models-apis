const { responseData } = require("../../helpers/responseData");
const cron_service = require("../../services/users/cron.services");
module.exports = {
  sendNotification: async (req, res) => {
    try {
      await cron_service.sendNotification(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
};
