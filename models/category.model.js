const mongoose = require("mongoose");
var aggregatePaginate = require("mongoose-aggregate-paginate-v2");

function imageURL (image) {
  //console.log(">>>>>>>>>>imageimageimage")
  if (image != null) {
    return process.env.IMAGE_PATH + image
  } else {
    return process.env.IMAGE_PATH + 'no_image.png'
    //   return null;
  }
}
const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    show_home: {
      // 0 =all  1 = Home
      type: Number,
      default: 0,
    },
    order_cat: {
      type: Number,
      default: 0,
    },
    image: { type: String, get: imageURL },
    // image: {
    //   type: String,
    // },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Countries",
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toObject: { getters: true, setters: true, virtuals: false },
    toJSON: { getters: true, setters: true, virtuals: false }
  }
);

CategorySchema.plugin(aggregatePaginate);
const Category = mongoose.model("Category", CategorySchema);

module.exports = Category;
