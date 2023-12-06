const Favorite = require("../../models/favorite.model");
const Country = require("../../models/countries.model");
const User = require("../../models/user.model");
const Product = require("../../models/product.model");
const Brand = require("../../models/brand.model");
const Order = require("../../models/order.model");
const Store = require("../../models/store.model");

const Promise = require("bluebird");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
const _ = require("lodash");
const { Types } = require("mongoose");
const { saveFile, saveThumbFile } = require("../../helpers/helper");
var moment = require("moment");
var momentTz = require("moment-timezone");
const { ObjectId } = require("mongodb");

module.exports = {
  add_favorite: async (req, res) => {
    try {
      const { product_id,store_id } = req.body;
      var user_id = req.user._id;

      const favorite = await Favorite.create({ user_id, product_id, store_id });
      
      if (!isEmpty(favorite)) {
        return res.json(responseData("FAVORITE_ADDED", favorite, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_favorite: async (req, res) => {
    try {
      var { _id } = req.user;
      const favorite = await Favorite.findOneAndRemove({
        product_id: req.params.id,
        user_id: _id,
      });
      if (!isEmpty(favorite)) {
        return res.json(responseData("FAVORITE_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_favorite: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        country_id,
        sort_type,
        start_date,
        end_date,
        timezone,
      } = req.query;
      keyword = _.trim(keyword);

      var user_id = req.user._id;
      var wholesaleCatId ='';
      var roleId ='';
      if(user_id){
        var user_data = await User.findOne({ _id: user_id});
        wholesaleCatId = user_data.wholesaleusercategory_id;
        roleId=user_data.role_id;
      }

      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};
      var match1 = {};
      match1 = {"product.status": true};
      if (status) {
        if (status == 1) {
          match.status = true;
        } else if (status == 0) {
          match.status = false;
        }
      }

      if (start_date) {
        start_date = new Date(
          momentTz
            .tz(start_date + " 00:00:00", timezone)
            .utc()
            .toISOString()
        );
      }
      if (end_date) {
        end_date = new Date(
          momentTz
            .tz(end_date + " 23:59:59", timezone)
            .utc()
            .toISOString()
        );
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: start_date,
          $lte: end_date,
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: start_date,
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: end_date,
        };
      }


      if (user_id) {
        match.user_id = Types.ObjectId(user_id);
      }

      // if (keyword) {
      //   match["$or"] = [
      //     { name: { $regex: keyword, $options: "i" } },
      //     { "country.name": { $regex: keyword, $options: "i" } },
      //   ];
      // }

      const query = Favorite.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "products",
            let: { id: "$product_id" },
            pipeline: [
              {
                  $match: {
                    $expr: { $eq: ["$$id", "$_id"] },
                  },
                },
                {
                  $lookup: {
                    from: "brands",
                    let: { id: "$brand_id" },
                    pipeline: [
                      {
                        $match: {
                          $expr: { $eq: ["$$id", "$_id"] },
                        },
                      },
                    ],
                    as: "brand",
                  },
                }, 
                {
                  $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $lookup: {
                    from: "sizecodes",
                    let: { id: "$size_code_id" },
                    pipeline: [
                      {
                        $match: {
                          $expr: { $eq: ["$$id", "$_id"] },
                        },
                      },
                    ],
                    as: "sizecode",
                  },
                },
                {
                  $unwind: {
                    path: "$sizecode",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $lookup: {
                    from: "vatcodes",
                    localField: "vat_code_id",
                    foreignField: "_id",
                    as: "vatcode",
                  },
                },
                {
                  $unwind: {
                    path: "$vatcode",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $lookup: {
                    from: "orders",
                    let:{ id: "$_id" },
                    pipeline: [
                      {
                        $match: {
                          $expr: { 
                              $and: [
                              { $eq: ["$user_id", ObjectId(user_id)] },
                              { $eq: ["$status", 1] },
                              {$in:["$$id","$items.id"]},
                          ],},
                        },
                      },
                    ],
                    as: "order",
                  },
                },
              ],
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        }, 
        {
          $match: match1,
        },
        {
          $project: {
            _id: 1,
            product_id: 1,
            store_id: 1,
            price: 1,
            offer_price: 1,
            user_id: 1,
            "product.vatcode":1,
            "brand.brand_id": { $ifNull: ["$product.brand._id", ""] },
            "brand.brand": { $ifNull: ["$product.brand.name", ""] },
            "product.product_unit":{ $ifNull: ["$product.sizecode.name", ""] },
            "product._id": { $ifNull: ["$product._id", ""] },
            "product.name": { $ifNull: ["$product.name", ""] },

            "product.size": { $ifNull: ["$product.size", ""] },
            "product.admin_limit": { $ifNull: ["$product.admin_limit", ""] },
            "product.min_qty_stock": { $ifNull: ["$product.min_qty_stock", ""] },

            "product.add_cart":{ $cond: [{ $gt: [{ $size: {$ifNull: ["$product.order", []]} }, 0] }, 1, 0]},
            "product.price": { $ifNull: ["$product.price", ""] },
            "product.offer_price": { $ifNull: ["$product.offer_price", ""] },
            "product.offer_start_at": { $ifNull: ["$product.offer_start_at", ""] },
            "product.offer_start_end": { $ifNull: ["$product.offer_start_end", ""] },
            "product.w_discount_per": { $ifNull: ["$product.w_discount_per", ""] },
            "product.w_offer_start_at": { $ifNull: ["$product.w_offer_start_at", ""] },
            "product.w_offer_start_end": { $ifNull: ["$product.w_offer_start_end", ""] },
            "product.bar_code": { $ifNull: ["$product.bar_code", ""] },
            "product.sku": { $ifNull: ["$product.sku", ""] },
            "product.images": {
              $map: {
                input: "$product.images",
                as: "image",
                in: {
                  $mergeObjects: [
                    "$$image",
                    {
                      name: {
                        $concat: [
                          process.env.IMAGE_LOCAL_PATH,
                          "product/",
                          "$$image.name"
                        ],
                      },
                    },
                  ],
                },
              },
            },
            "product.w_prices": {
              $filter: {
                input: "$product.w_prices",
                as: "w_price",
                cond: { $eq: ["$$w_price.c_id", wholesaleCatId] },
              },
            },
            // "store._id": { $ifNull: ["$store._id", ""] },
            // "store.name": { $ifNull: ["$store.name", ""] },
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Favorite.aggregatePaginate(query, options);
      
      var current_timestamp = moment().unix();
        if (!isEmpty(finaldata)) {
          console.log('ddgggggggggggggg');
          await Promise.map(finaldata.docs, async (el) => {
            console.log('dd');
            var offer_start = el.product.offer_start_at;
            var offer_end = el.product.offer_start_end;

            var w_offer_start = el.product.w_offer_start_at;
            var w_offer_end = el.product.w_offer_start_end;

            //el.product.offer_percent = parseFloat((el.product.offer_percent).toFixed(2));
            el.product.offer_percent = (((el.product.price-el.product.offer_price)/el.product.price)*100).toFixed(2);
            
            
            if(roleId==2 && el.product.w_prices.length){

              el.product.offer_percent=el.product.w_discount_per;
              let vatAmount_price = parseFloat(
                parseFloat((el.product.w_discount_per / 100) * el.product.w_prices?.[0]?.price ?? 0).toFixed(2)
              );
              //if(w_offer_start && current_timestamp >= w_offer_start && current_timestamp <= w_offer_end) {
              if((current_timestamp >= w_offer_start && current_timestamp <= w_offer_end && w_offer_start && w_offer_end) || ( current_timestamp >= w_offer_start && (w_offer_end == null || w_offer_end == "") && w_offer_start) || ( (w_offer_start == null || w_offer_start == "") && current_timestamp <= w_offer_end && w_offer_end)) {
                el.product.offer_flag=1;
                el.product.offer_price=el.product.w_prices?.[0]?.price - vatAmount_price;
              }else{
                  el.product.offer_flag=0;
                  el.product.offer_price=el.product.w_prices?.[0]?.price ?? 0;
              }
             
              el.product.price=el.product.w_prices?.[0]?.price ?? 0;
              
            }else{
              // let vatAmount_price = parseFloat(
              //   parseFloat((el.product.vat_percent / 100) * el.product.price).toFixed(2)
              // );
              // let vatAmount_offer = parseFloat(
              //   parseFloat((el.product.vat_percent / 100) * el.product.offer_price).toFixed(2)
              // );

              //if( offer_start && current_timestamp >= offer_start && current_timestamp <= offer_end) {
              if((current_timestamp >= offer_start && current_timestamp <= offer_end && offer_start && offer_end) || ( current_timestamp >= offer_start && (offer_end == null || offer_end == "") && offer_start) || ( (offer_start == null || offer_start == "") && current_timestamp <= offer_end && offer_end)) {
                  el.product.offer_flag=1;
              }else{
                  el.product.offer_flag=0;
              }
              // el.product.price=el.product.price + vatAmount_price;
              // el.product.offer_price=el.product.offer_price + vatAmount_offer;
            }
          });
        }
      
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
