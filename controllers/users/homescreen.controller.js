const { responseData } = require('../../helpers/responseData');
const homeService = require("../../services/users/homescreen.services");
module.exports = {
    list_home_image: async (req, res) => {
        try {
            await homeService.list_home_image(req, res)
            //console.log("list_home_image");
        } catch (err) {
            var msg = err.message || 'SOMETHING_WENT_WRONG';
            return res.status(422).json(responseData(msg, {}, req))
        }
    }
}