const Product = require("../../models/product.model");
const StoreProduct = require("../../models/storeproduct.model");
const Country = require("../../models/countries.model");
const Supplier = require("../../models/supplier.model");
const Brand = require("../../models/brand.model");
const VATCode = require("../../models/vat_code.model");
const Category = require("../../models/category.model");
const SizeCode = require("../../models/sizecode.model");
const Store = require("../../models/store.model");
var { isEmpty, isSet } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
const _ = require("lodash");
const { Types } = require("mongoose");
const exists = require("fs-await-exists");
const Promise = require("bluebird");
const async = require("async");
var moment = require("moment");
var momentTz = require("moment-timezone");
const {
  list_to_tree,
} = require("../../helpers/helper");
module.exports = {
  list_category: async (req, res) => {
    try {
      let { country_name } = req.query;

      var countryData = await Country.findOne({
        name: country_name
      });

      if (countryData?._id) {

        var match = {};
        match.country_id = Types.ObjectId(countryData._id);
        const allCategories = await Category.aggregate([
          { $match: match },
          {
            $project: {
              _id: 1,
              name: 1,
              show_home: 1,
              order_cat:1,
              image:{
                $cond: {
                  if: { $ne: ['$image', null] },
                  then: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, '$image'] },
                  else: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, 'no_image.png'] }
                }
              },
              status: 1,
              parent: { $ifNull: ["$parent", ""] },
            },
          },
          { $sort: { show_home: -1,order_cat:1 } },
        ]);

        
        
        console.log(allCategories);
        //const ten='';
        const ten = await list_to_tree(allCategories);
        return res.json(
          responseData("GET_LIST", ten, req, true)
        );
        
      } else {
        return res.json(responseData("NOT_FOUND", [], req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  home_category: async (req, res) => {
    try {
      let { country_name } = req.query;

      var countryData = await Country.findOne({
        name: country_name
      });

      if (countryData?._id) {

        var match = {};
        match.country_id = Types.ObjectId(countryData._id);
        const allCategories = await Category.aggregate([
          { $match: match },
          {
            $project: {
              _id: 1,
              name: 1,
              show_home: 1,
              order_cat:1,
              image:{
                $cond: {
                  if: { $ne: ['$image', null] },
                  then: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, '$image'] },
                  else: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, 'no_image.png'] }
                }
              },
              status: 1,
              parent: { $ifNull: ["$parent", ""] },
            },
          },
          { $sort: { show_home: -1,order_cat:1 } },
          { $limit: 8 },
        ]);

        
        
        console.log(allCategories);
        //const ten='';
        const ten = await list_to_tree(allCategories);
        return res.json(
          responseData("GET_LIST", ten, req, true)
        );
        
      } else {
        return res.json(responseData("NOT_FOUND", [], req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_category_old: async (req, res) => {
    try {
      let { longitude, latitude } = req.body;
      const sortOptions = {
        ["name"]: 1,
      };

      const allStores = await Store.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            distanceField: "distance",
          },
        },
        { $match: { $expr: { $lte: ["$distance", 20000] } } },
        //{ $match: { $expr: { $lte: ["$distance", "$store_radius"] } } },
      ]);

      if (allStores.length > 0) {
        var match = {};
        if (allStores[0]._id) {
          match.store_id = Types.ObjectId(allStores[0]._id);
        }

        const storeProductData = await StoreProduct.aggregate([
          {
            $match: match,
          },
          {
            $lookup: {
              from: "products",
              localField: "product_id",
              foreignField: "_id",
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
            $lookup: {
              from: "stores",
              localField: "store_id",
              foreignField: "_id",
              as: "store",
            },
          },
          {
            $unwind: {
              path: "$store",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              product_id: 1,
              store_id: 1,
              categories: { $ifNull: ["$product.categories", ""] },
            },
          },
          {
            $sort: sortOptions,
          },
        ]).collation({ locale: "en", strength: 1 });

        if (storeProductData) {
          let category_arr = [];
          storeProductData.forEach(function (item, index) {
            let data = item.categories;
            var len1 = data.length;
            for (let j = 0; j < len1; j++) {
              category_arr.push(data[j].toString());
            }
          });

          if (category_arr) {
            category_arr = [...new Set(category_arr)];
            let categories_list = [];
            async.eachSeries(
              category_arr,
              (item, callback) => {
                var cat = Category.findOne({
                  _id: Types.ObjectId(item),
                  parent:undefined
                })
                  .then((item_new) => {
                    console.log("->>>>>>>>>>>>>cat", item_new);
                    if(item_new){
                      categories_list.push(item_new);
                    }
                    callback(null);
                  })
                  .catch((error) => {
                    callback(error);
                  });
              },
              async (error) => {
                if (error) {
                  return res.json(responseData(error, {}, req, false));
                }
                console.log("categories_list", categories_list);
                if (!isEmpty(categories_list) && categories_list!=null) {
                  let new_categories_list_sort = categories_list.sort(
                    (a, b) => b.show_home - a.show_home  || a.order_cat - b.order_cat
                  );
                  return res.json(
                    responseData("GET_LIST", new_categories_list_sort, req, true)
                  );
                } else {
                  return res.json(responseData("NOT_FOUND", {}, req, false));
                }
              }
            );
          } else {
            return res.json(responseData("NOT_FOUND", {}, req, false));
          }
        } else {
          return res.json(responseData("NOT_FOUND", {}, req, false));
        }
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_sub_category: async (req, res) => {
    try {
      let { longitude, latitude,category_id} = req.body;
      const sortOptions = {
        ["name"]: 1,
      };

      var result = await Category.find({
        parent: Types.ObjectId(category_id),
      });

      const allStores = await Store.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            distanceField: "distance",
          },
        },
        { $match: { $expr: { $lte: ["$distance", 20000] } } },
        //{ $match: { $expr: { $lte: ["$distance", "$store_radius"] } } },
      ]);

      if (allStores.length > 0) {
        var match = {};
        if (allStores[0]._id) {
          match.store_id = Types.ObjectId(allStores[0]._id);
        }

        const storeProductData = await StoreProduct.aggregate([
          {
            $match: match,
          },
          {
            $lookup: {
              from: "products",
              localField: "product_id",
              foreignField: "_id",
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
            $lookup: {
              from: "stores",
              localField: "store_id",
              foreignField: "_id",
              as: "store",
            },
          },
          {
            $unwind: {
              path: "$store",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              product_id: 1,
              store_id: 1,
              categories: { $ifNull: ["$product.categories", ""] },
            },
          },
          {
            $sort: sortOptions,
          },
        ]).collation({ locale: "en", strength: 1 });

        if (storeProductData) {
          let category_arr = [];
          storeProductData.forEach(function (item, index) {
            let data = item.categories;
            var len1 = data.length;
            for (let j = 0; j < len1; j++) {
              category_arr.push(data[j].toString());
            }
          });

          if (category_arr) {
            category_arr = [...new Set(category_arr)];
            let categories_list = [];
            async.eachSeries(
              category_arr,
              (item, callback) => {
                var cat = Category.findOne({
                  _id: Types.ObjectId(item),
                  parent:undefined
                })
                  .then((item_new) => {
                    console.log("->>>>>>>>>>>>>cat", item_new);
                    if(item_new){
                      categories_list.push(item_new);
                    }
                    callback(null);
                  })
                  .catch((error) => {
                    callback(error);
                  });
              },
              async (error) => {
                if (error) {
                  return res.json(responseData(error, {}, req, false));
                }
                console.log("categories_list", categories_list);
                if (!isEmpty(categories_list) && categories_list!=null) {
                  let new_categories_list_sort = categories_list.sort(
                    (a, b) => b.show_home - a.show_home  || a.order_cat - b.order_cat
                  );
                  return res.json(
                    responseData("GET_LIST", new_categories_list_sort, req, true)
                  );
                } else {
                  return res.json(responseData("NOT_FOUND", {}, req, false));
                }
              }
            );
          } else {
            return res.json(responseData("NOT_FOUND", {}, req, false));
          }
        } else {
          return res.json(responseData("NOT_FOUND", {}, req, false));
        }
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_sub_category1: async (req, res) => {
    try {

      const { category_id } = req.body;

      console.log(category_id);
      var result = await Category.find({
        parent: Types.ObjectId(category_id),
      });
      if (result) {
        return res.json(
          responseData("GET_LIST", result, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  searchCategory: async (req, res) => {
    try {
      let { country_name ,keyword,sort_by,sort_type,page,limit} = req.query;

      var countryData = await Country.findOne({
        name: { $regex: country_name, $options: "i" }
      });
      
      if (countryData) {
        var match = {};
        if (countryData?._id) {
          match["country_id"] = Types.ObjectId(countryData._id);
        }
        if (keyword) {
          match["name"] = { $regex: _.trim(keyword), $options: "i" };
        }else{
          return res.json(responseData("NOT_FOUND", {}, req, false));
        }
        const sortOptions = {
          [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
        };
        
        const options = {
          page: page || 1,
          limit: limit || 10,
          sort_by: sortOptions,
        };

        let allCategories = await  Category.aggregate([
          { $match: match},
          {
            $project: {
              _id: 1,
              name: 1,
              show_home: 1,
              order_cat:1,
              image:{
                $cond: {
                  if: { $ne: ['$image', null] },
                  then: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, '$image'] },
                  else: { $concat: [`${process.env.IMAGE_LOCAL_PATH}category/`, 'no_image.png'] }
                }
              },
              status: 1,
              parent: { $ifNull: ["$parent", ""] },
            },
          },
        ]);
        const ten = await list_to_tree(allCategories);
        // console.log("optionnn->>>>", options);
        // var finaldata = await Category.aggregatePaginate(
        //   productData,
        //   options
        // );

        if (!isEmpty(ten)) {
          return res.json(responseData("GET_LIST", ten, req, true));
        } else {
          return res.json(responseData("NOT_FOUND", [], req, false));
        }
      } else {
        return res.json(responseData("NOT_FOUND", [], req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
