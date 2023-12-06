const { responseData } = require("../../helpers/responseData");
const booking_service = require('../../services/admins/booking.services')
module.exports = {
    // add_booking: async (req, res) => {
    //     try {
    //         await booking_service.add_booking(req, res);
    //     } catch (err) {
    //         var msg = err.message || "SOMETHING_WENT_WRONG";
    //         return res.status(422).json(responseData(msg, {}, req));
    //     }
    // },
    bookingList: async (req, res) => {
        try {
            await booking_service.bookingList(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    booking_detail: async (req, res) => {
        try {
            await booking_service.booking_detail(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    edit_booking: async (req, res) => {
        try {
            await booking_service.edit_booking(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    change_sp: async (req, res) => {
        try {
            await booking_service.change_sp(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    assign_sp: async (req, res) => {
        try {
            await booking_service.assign_sp(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    list: async (req, res) => {
        try {
            await booking_service.list(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    list_of_sp: async (req, res) => {
        try {
            await booking_service.list_of_sp(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    report_list:async (req, res) => {
        try {
            await booking_service.report_list(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    report_to_csv:async (req, res) => {
        try {
            await booking_service.report_to_csv(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    list_of_cancel_booking:async (req, res) => {
        try {
            await booking_service.list_of_cancel_booking(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
    accept_the_cancel:async (req, res) => {
        try {
            await booking_service.accept_the_cancel(req, res);
        } catch (err) {
            var msg = err.message || "SOMETHING_WENT_WRONG";
            return res.status(422).json(responseData(msg, {}, req));
        }
    },
}