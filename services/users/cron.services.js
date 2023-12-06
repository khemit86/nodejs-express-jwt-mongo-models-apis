const BulkNotification = require("../../models/bulknotification.model");
const Notification = require("../../models/notification.model");
const ProductInventory = require("../../models/productinventory.model");
const { Types } = require("mongoose");

const { responseData } = require("../../helpers/responseData");
const { sendNotificationBulk, syncInventory } = require("../../helpers/helper");

module.exports = {
  sendNotification: async (req, res) => {
    try {
      let query;
      const allTokens = [];
      const allNotifications = [];
      const queue = await BulkNotification.aggregate([{ $limit: 1 }]);
      if (queue.length > 0) {
        // console.log("queue", queue[0]?._id)
        for (let i = 0; i < queue[0].users.length; i++) {
          allTokens.push(queue[0].users[i]["device_token"]);
          allNotifications.push({
            user_id: queue[0].users[i]["_id"],
            // title: queue[0].description,
            type: "Admin",
            title: "New Notification from Admin.",
            body: queue[0].description,
          });
        }
        await Notification.insertMany(allNotifications);
        await sendNotificationBulk({
          deviceToken: allTokens,
          title: "New Notification from Admin.",
          body: queue[0].description,
        });
        await BulkNotification.deleteOne({ _id: queue[0]._id });
        //console.log(queue[0].description);
        //console.log(allTokens);
      }

      if (req) {
        return res.json(responseData("GET_LIST", {}, req, true));
      }
    } catch (error) {
      if (req) {
        return res.json(responseData("ERROR_OCCUR", error.message, req, false));
      }
    }
  },
  product_inventory: async (req, res) => {
    try {
      const all_product = await ProductInventory.aggregate([
        { $match: { sync: false } },
        { $limit: 100 },
      ]);
      if (all_product.length > 0) {
        for (let item = 0; item < all_product.length; item++) {
          await syncInventory(
            Types.ObjectId(all_product[item].store_id),
            Types.ObjectId(all_product[item].product_id)
          );
          await ProductInventory.updateOne(
            { _id: all_product[item]._id },
            { $set: { sync: true } },
            { new: true }
          );
        }
      }
      if (req) {
        return res.json(responseData("GET_LIST", {}, req, true));
      }
    } catch (error) {
      if (req) {
        return res.json(responseData("ERROR_OCCUR", error.message, req, false));
      }
    }
  },
};
