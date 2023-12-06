const mongoose = require("mongoose");
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const BulkNotificationSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    users: { type: Array, required: false, default: [] },
  },

  {
    timestamps: true,
  }
);

BulkNotificationSchema.plugin(aggregatePaginate);
const BulkNotification = mongoose.model(
  "BulkNotification",
  BulkNotificationSchema
);

module.exports = BulkNotification;
