const { responseData } = require("../../helpers/responseData");
const admin_service = require("../../services/admins/admin.services");
module.exports = {
  // add_admin: async (req, res) => {
  //     try {
  //         await admin_service.add_admin(req, res);
  //     } catch (err) {
  //         var msg = err.message || "SOMETHING_WENT_WRONG";
  //         return res.status(422).json(responseData(msg, {}, req));
  //     }
  // },
  admin_login: async (req, res) => {
    try {
      await admin_service.admin_login(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  admin_profile: async (req, res) => {
    try {
      await admin_service.admin_profile(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  admin_forgot_password: async (req, res) => {
    try {
      await admin_service.admin_forgot_password(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  dials: async (req, res) => {
    try {
      await admin_service.dials(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  admin_reset_password: async (req, res) => {
    try {
      await admin_service.admin_reset_password(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  changePassword: async (req, res) => {
    try {
      await admin_service.changePassword(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  edit_admin: async (req, res) => {
    try {
      await admin_service.edit_admin(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
  country_list: async (req, res) => {
    try {
      await admin_service.country_list(req, res);
    } catch (err) {
      var msg = err.message || "SOMETHING_WENT_WRONG";
      return res.status(422).json(responseData(msg, {}, req));
    }
  },
};
