const { responseData } = require("../../helpers/responseData");
const cms_service = require('../../services/users/cms.services')
module.exports = {
    staticPage: async (req, res) => {
        try {
            await cms_service.staticPage(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    }
}