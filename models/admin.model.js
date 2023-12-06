const mongoose = require("mongoose");
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

function imageURL(image) {
  // const path = config.USER + '/' + image;
  if (image != null) {
    return process.env.IMAGE_LOCAL_PATH + image;
  } else {
    return process.env.IMAGE_LOCAL_PATH + "no_image.png";
    //   return null;
  }
}

const AdminSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: false,
      trim: true,
    },
    country_code: {
      type: String,
      required: false,
    },
    mobile: {
      type: String,
    },
    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Countries",
      required: false,
    },
    city_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cities",
      required: false,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stores",
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    role_id: {
      // 1 super admin 2 country 3 city 4 store
      type: Number,
      default: 2,
    },
    permission: {
      type: Array,
    },
    status: {
      type: Boolean,
      required: false,
      default: true,
    },
    token: {
      type: String,
    },
    device_token: {
      type: String,
      default: "",
      required: false,
    },
  },
  {
    timestamps: true,
    toObject: { getters: true, setters: true, virtuals: false },
    toJSON: { getters: true, setters: true, virtuals: false },
  }
);
AdminSchema.plugin(aggregatePaginate);
const Admin = mongoose.model("Admin", AdminSchema);

module.exports = Admin;
