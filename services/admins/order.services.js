const Order = require("../../models/order.model");
const User = require("../../models/user.model");
const ProductInventory = require("../../models/productinventory.model");
const Log = require("../../models/log.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const _ = require("lodash");
const { Types } = require("mongoose");
const { Store } = require("express-session");
const Promise = require("bluebird");
var momentTz = require("moment-timezone");
var moment = require("moment");
var { Parser } = require("json2csv");
const path = require("path");
const fs = require("fs");
const email_service = require("../admins/emailtemplate.services");
var html = fs.readFileSync(
  path.join(__dirname, "../../email_layouts/pdf_generate.html"),
  "utf8"
);
const {
  base64Encode,
  base64Decode,
  sendNotificationOrderStatusChange,
  syncInventory,
  addLog,
  pdfGenerate,
  sendEmail,
  sendOrderConfirmationEmail,
} = require("../../helpers/helper");

module.exports = {
  delete_order: async (req, res) => {
    try {
      const order = await Order.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(order)) {
        return res.json(responseData("ORDER_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        store_id,
        brand,
        product,
        category,
        post_code,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        transaction_id,
        city_id,
        country_id,
        flag,
        customer_id,
        driver_name,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        status: 0,
        is_cancelled: 0,
      };
      var match2 = {};
      var projectkey = {};
      if (Number(flag) === 1) {
        // Complete order List
        match.delivery_status = 5;
      } else if (Number(flag) === 2) {
        // Assign delivery boy
        match.driver_id = { $ne: undefined };
        match.delivery_status = { $in: [3, 4] };
        projectkey.deliveryBoyList = 1;
      } else if (Number(flag) === 3) {
        // Return Order List
        (match.delivery_status = 5), (match.return_quantity = { $gt: 0 });
      } else if (Number(flag) === 4) {
        // Un Assign Delivery Boy
        (match.driver_id = { $eq: undefined }), (match.delivery_status = 2);
        projectkey.deliveryBoyList = 1;
      } else if (Number(flag) === 5) {
        // Earning List
        match.payment_status = 1;
        match.delivery_status = 5;
      } else if (Number(flag) === 6) {
        // is Cancelled Order list
        match.is_cancelled = 1;
      } else {
        // Order List
        match.delivery_status = 1;
      }

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      if (post_code) {
        match["address.zip_code"] = base64Encode(post_code);
      }

      if (customer_id) {
        match["user_id"] = Types.ObjectId(customer_id);
        delete match.delivery_status;
      }

      if (product_id) {
        match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      }

      if (order_id) {
        match["order_id"] = Number(order_id);
      }

      if (transaction_id) {
        match["transaction_id"] = { $regex: transaction_id, $options: "i" };
      }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (keyword) {
        keyword = base64Encode(keyword);
        match2["$or"] = [
          { "user.first_name": { $regex: keyword, $options: "i" } },
          { "user.last_name": { $regex: keyword, $options: "i" } },
        ];
      }

      if (driver_name) {
        driver_name = base64Encode(driver_name);
        match2["$or"] = [
          { "driver.first_name": { $regex: driver_name, $options: "i" } },
          { "driver.last_name": { $regex: driver_name, $options: "i" } },
        ];
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                  is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            order_id: 1,
            invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            "user.is_credit_user": 1,
            is_cancelled: 1,
            items: 1,
            total_margin: 1,
            total_taxable: 1,
            transaction_id: 1,
            special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            note: 1,
            driver_id: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            driver: { $ifNull: ["$driver", {}] },
            ...projectkey,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        if (el.user.first_name)
          el.user.first_name = base64Decode(el.user.first_name);
        else 
          el.user.first_name = "";
        if (el.user.last_name)
          el.user.last_name = base64Decode(el.user.last_name);
        else 
          el.user.last_name = "";

        if (el?.address?.zip_code != null && el?.address?.zip_code != "")
          el.address.zip_code = base64Decode(el?.address.zip_code);
        else 
          el.address.zip_code = "";

        if (el?.address?.full_address)
          el.address.full_address = base64Decode(el?.address?.full_address);
        else 
          el.address.full_address = "";
          
        if (el?.deliveryBoyList) {
          await Promise.map(el?.deliveryBoyList, async (dl, index) => {
            dl.first_name = base64Decode(dl.first_name);
            dl.last_name = base64Decode(dl.last_name);
          });
        }
        if (el?.driver) {
          if (el?.driver?.first_name)
            el.driver.first_name = base64Decode(el?.driver?.first_name);
          if (el?.driver?.last_name)
            el.driver.last_name = base64Decode(el?.driver?.last_name);
        }
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_return: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        sort_type,
        product_id,
        start_date,
        end_date,
        country_id,
        city_id,
        order_id,
        transaction_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};
      var match2 = {};
      match.delivery_status = 5;
      match.return_quantity = { $gt: 0 };

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }
      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }
      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (product_id) {
        match2["items.id"] = Types.ObjectId(product_id);
      }

      if (order_id) {
        match["order_id"] = Number(order_id);
      }
      if (transaction_id) {
        match["transaction_id"] = transaction_id;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }

      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $unwind: { path: "$items", preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            order_id: 1,
            invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            items: 1,
            transaction_id: 1,
            // special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            driver_id: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        if (el?.deliveryBoyList) {
          await Promise.map(el?.deliveryBoyList, async (dl, index) => {
            dl.first_name = base64Decode(dl.first_name);
            dl.last_name = base64Decode(dl.last_name);
          });
        }
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  deliveryBoyList: async (req, res) => {
    try {
      const list = await User.aggregate([
        { $match: { role_id: 3 } },
        { $project: { first_name: 1, last_name: 1 } },
      ]);
      await Promise.map(list, async (el, index) => {
        el.first_name = base64Decode(el.first_name);
        el.last_name = base64Decode(el.last_name);
      });
      return res.json(responseData("GET_LIST", list, req, true));
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  assigndeliveryBoyOrder: async (req, res) => {
    try {
      const { order_id, delivery_boy_id } = req.body;
      const order = await Order.findByIdAndUpdate(
        { _id: Types.ObjectId(order_id) },
        { $set: { driver_id: delivery_boy_id, delivery_status: 3 } },
        { new: true }
      );

      addLog(
        req.user._id,
        "Order Status Updated",
        "#" + order.order_id,
        "Order Status Changed for order id #" +
          order.order_id +
          " Delivery Boy Assigned",
        Types.ObjectId(order_id)
      );

      sendNotificationOrderStatusChange(order_id);
      if (order._id) {
        return res.json(responseData("ASSIGN_DRIVER_BOY", {}, req, true));
      } else {
        return res.json(responseData("WUSER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  earningList: async (req, res) => {
    try {
      // product
      // Store
      // category
      // brand
      // payment status
      // payment mode
      // delievery status

      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        store_id,
        brand,
        product,
        category,
        post_code,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        transaction_id,
        country_id,
        flag,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};

      match.payment_status = 1;

      if (status) {
        if (status == 1) {
          match.status = true;
        } else if (status == 0) {
          match.status = false;
        }
      }

      if (country_id) {
        match["$or"] = [{ "user.country._id": Types.ObjectId(country_id) }];
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      if (post_code) {
        match.post_code = Number(post_code);
      }

      if (product_id) {
        match["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      }

      if (order_id) {
        match["$or"] = [{ order_id: { $regex: order_id, $options: "i" } }];
      }

      if (transaction_id) {
        match["$or"] = [
          { transaction_id: { $regex: transaction_id, $options: "i" } },
        ];
      }

      if (category) {
        match["$or"] = [{ "items.categories": { $in: [category] } }];
      }

      if (brand) {
        match["$or"] = [{ "items.brand": { $regex: brand, $options: "i" } }];
      }

      if (product) {
        match["$or"] = [{ "items.name": { $regex: product, $options: "i" } }];
      }

      if (keyword) {
        match["$or"] = [
          { "user.first_name": { $regex: keyword, $options: "i" } },
        ];
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }

      const query = Order.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  country: 1,
                  city: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
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
          $unwind: "$store",
        },
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            quantity: 1,
            subtotal: 1,
            discount: 1,
            vat: 1,
            // country: 1,
            vat_inclusive: 1,
            payment_status: 1,
            payment_mode: 1,
            delivery_status: 1,
            delivery_type: 1,
            post_code: 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "store._id": 1,
            "store.name": 1,
            country: { $ifNull: ["$user.country", {}] },
            city: { $ifNull: ["$user.city", {}] },
            order_id: 1,
            total: 1,
            status: 1,
            items: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  get_ofd_products: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        country_id,
        city_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};
      var match2 = {};

      match.delivery_status = { $nin: [4, 5] };
      match.status = 0;

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (city_id) {
        match2["store.city_id"] = Types.ObjectId(city_id);
      }

      if (country_id) {
        match2["store.country_id"] = Types.ObjectId(country_id);
      }

      if (product_id) {
        match["items.id"] = Types.ObjectId(product_id);
        match2["items.id"] = Types.ObjectId(product_id);
      }
      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      const query = Order.aggregate([
        {
          $match: match,
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
          $unwind: {
            path: "$items",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: match2,
        },
        {
          $project: {
            name: 1,
            placedAt: 1,
            store_id: 1,
            store: 1,
            order_id: 1,
            createdAt: 1,
            "items.id": 1,
            "items.quantity": 1,
            "items.name": 1,
            "items.categories": 1,
            "items.brand": 1,
          },
        },
        {
          $group: {
            //_id: "$items.id",
            _id: {
              // group by multiple fields.
              x: "$store_id",
              y: "$items.id",
            },
            order_id: { $first: "$order_id" },
            quantity: { $sum: "$items.quantity" },
            item_id: { $first: "$items.id" },
            placedAt: { $first: "$placedAt" },
            store_id: { $first: "$store._id" },
            store_name: { $first: "$store.name" },
            country_id: { $first: "$store.country_id" },
            city_id: { $first: "$store.city_id" },
            name: { $first: "$items.name" },
            categories: { $first: "$items.categories" },
            brand: { $first: "$items.brand" },
            createdAt: { $first: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "countries",
            localField: "country_id",
            foreignField: "_id",
            as: "country",
          },
        },
        {
          $unwind: {
            path: "$country",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "cities",
            localField: "city_id",
            foreignField: "_id",
            as: "city",
          },
        },
        {
          $unwind: {
            path: "$city",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  order_detail: async (req, res) => {
    try {
      const { order_id } = req.query;
      const finaldata = await Order.aggregate([
        {
          $match: { order_id: Number(order_id) },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $project: {
            name: 1,
            "store._id": 1,
            "store.name": 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            order_id: 1,
            invoice_no: 1,
            transaction_id: 1,
            special_instruction: 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            total_taxable: 1,
            total_margin: 1,
            placedAt: 1,
            quantity: 1,
            total: 1,
            subtotal: 1,
            vat: 1,
            discount: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_price: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            address: 1,
            return_amount: 1,
            return_quantity: 1,
            is_cancelled: 1,
            is_rescheduled: 1,
            delivery_night_charges: 1,
            driver: { $ifNull: ["$driver", {}] },
            items: 1,
            // "items.quantity": 1,
            // "items.name": 1,
            // "items.categories": 1,
            // "items.brand": 1,
            // "items.return_quantity": 1,
            // "items.return_amount": 1,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ]).collation({ locale: "en", strength: 1 });

      await Promise.map(finaldata, async (item, index) => {
        if (!isEmpty(item.user.first_name))
          item.user.first_name = base64Decode(item.user.first_name);
        if (!isEmpty(item.user.last_name))
          item.user.last_name = base64Decode(item.user.last_name);

        if (item?.address?.name != "" && item?.address?.name != null) 
          item.address.name = base64Decode(item?.address?.name);
        else 
          item.address.name = "";

        if (item?.address?.address != "" && item?.address?.address != null) 
          item.address.address = base64Decode(item?.address?.address);
        else 
          item.address.address = "";
          
        if (item?.address?.full_address != "" && item?.address?.full_address != null) 
          item.address.full_address = base64Decode(item?.address?.full_address);
        else 
          item.address.full_address = "";

        if (item?.address?.zip_code != "" && item?.address?.zip_code != null) 
          item.address.zip_code = base64Decode(item?.address?.zip_code);
        else 
          item.address.zip_code = "";

        if (item?.address?.delivery_contact != "" && item?.address?.delivery_contact != null) 
          item.address.delivery_contact = base64Decode(item?.address?.delivery_contact);
        else 
          item.address.delivery_contact = "";
          
        if (item?.address?.delivery_landmark != "" && item?.address?.delivery_landmark != null) 
          item.address.delivery_landmark = base64Decode(item?.address?.delivery_landmark);
        else 
          item.address.delivery_landmark = "";
          
        if (item?.address?.street != "" && item?.address?.street != null) 
          item.address.street = base64Decode(item?.address?.street);
        else 
          item.address.street = "";
  
        if (item?.address?.building != "" && item?.address?.building != null) 
          item.address.building = base64Decode(item?.address?.building);
        else 
          item.address.building = "";
            
        if (item?.address?.office_no != "" && item?.address?.office_no != null) 
          item.address.office_no = base64Decode(item?.address?.office_no);
        else 
          item.address.office_no = "";
  
        if (item?.address?.apartment_no != "" && item?.address?.apartment_no != null) 
          item.address.apartment_no = base64Decode(item?.address?.apartment_no);
        else 
          item.address.apartment_no = "";
  
        if (item?.address?.city != "" && item?.address?.city != null) 
          item.address.city = base64Decode(item?.address?.city);
        else 
          item.address.city = "";
            
        if (item?.address?.house_no != "" && item?.address?.house_no != null) 
          item.address.house_no = base64Decode(item?.address?.house_no);
        else 
          item.address.house_no = "";

          if (item?.driver) {
            if (item?.driver?.first_name)
              item.driver.first_name = base64Decode(item?.driver?.first_name);
            if (item?.driver?.last_name)
              item.driver.last_name = base64Decode(item?.driver?.last_name);
          }
        
      });

      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata[0], req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  update_order_detail: async (req, res) => {
    try {
      const { order_id, return_quantity, index } = req.body;

      const orderdata = await Order.findOne({
        order_id: Number(order_id),
      }).populate("user_id", "first_name last_name country_id city_id role_id");
      if (orderdata?.delivery_status === 5) {
        var items = orderdata.items;
        var returnQuantity = orderdata.return_quantity
          ? orderdata.return_quantity
          : 0;
        var returnAmount = orderdata.return_amount
          ? orderdata.return_amount
          : 0;
        items[index].return_quantity = Number(return_quantity);
        items[index].return_amount =
          Number(return_quantity) * Number(items[index].unitPrice);
        returnQuantity += Number(return_quantity);
        returnAmount +=
          Number(return_quantity) * Number(items[index].unitPrice);
        const updatedata = await Order.findOneAndUpdate(
          { order_id: Number(order_id) },
          {
            $set: {
              items: items,
              return_quantity: returnQuantity,
              return_amount: returnAmount,
            },
          },
          { new: true }
        );
        var obj = {};
        if (orderdata?.user_id?.role_id == 1) obj.quantity_c = return_quantity;
        if (orderdata?.user_id?.role_id == 2) obj.quantity_w = return_quantity;
        var inventoryCreate = await ProductInventory.create({
          user_id: Types.ObjectId(orderdata?.user_id?._id),
          country_id: Types.ObjectId(items[index]?.country_id),
          city_id: Types.ObjectId(items[index]?.country_id),
          store_id: Types.ObjectId(orderdata?.store_id),
          order_id: Types.ObjectId(orderdata?._id),
          order_no: orderdata?.order_id,
          product_id: Types.ObjectId(items[index].id),
          type: 2,
          ...obj,
        });
        await syncInventory(
          Types.ObjectId(orderdata?.store_id),
          Types.ObjectId(items[index].id)
        );
        if (!isEmpty(updatedata)) {
          return res.json(
            responseData("ORDER_UPDATED_SUCCESSFULLY", updatedata, req, true)
          );
        } else {
          return res.json(responseData("NOT_FOUND", {}, req, false));
        }
      } else {
        return res.json(
          responseData("ONLY_DELIVERED_ORDERED_UPDATE", {}, req, false)
        );
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  add_note: async (req, res) => {
    try {
      var { id, note } = req.body;
      let orderDetails = await Order.findOne({ _id: Types.ObjectId(id) });
      if (!isEmpty(orderDetails)) {
        let updateOrder = await Order.findByIdAndUpdate(
          { _id: Types.ObjectId(id) },
          { $set: { note: note } },
          { new: true }
        );
        return res.json(
          responseData("NOTE_UPDATE_SUCCESSFULLY", updateOrder, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  wholeseller_paid: async (req, res) => {
    try {
      var { id } = req.query;
      let orderDetails = await Order.findOne({ _id: Types.ObjectId(id) });
      if (!isEmpty(orderDetails)) {
        const invoice_no_details = await Order.aggregate([
          { $match: { invoice_no: { $ne: "" } } },
          {
            $group: {
              _id: null,
              invoice_no: { $max: "$invoice_no" },
            },
          },
        ]);
        if (invoice_no_details.length > 0) {
          if (invoice_no_details[0].invoice_no) {
            var invoice_no = parseInt(invoice_no_details[0].invoice_no);

            invoice_no = invoice_no + 1;
          } else {
            invoice_no = 1;
          }
        } else {
          invoice_no = 1;
        }

        let updateOrder = await Order.findByIdAndUpdate(
          { _id: Types.ObjectId(id) },
          { $set: { payment_status: 1, invoice_no: invoice_no } },
          { new: true }
        );

        // true means send invoice instead of confirmation email.
        await sendOrderConfirmationEmail(id, true);
        return res.json(
          responseData("PAYMENT_UPDATED_SUCCESSFULLY", updateOrder, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  order_logs_list: async (req, res) => {
    try {
      var { id } = req.query;
      let orderDetails = await Order.findOne({ _id: Types.ObjectId(id) });
      if (!isEmpty(orderDetails)) {
        let allLogs = await Log.aggregate([
          {
            $match: {
              entity_id: orderDetails?._id,
              type: { $in: ["Order Status Updated", "Order Placed"] },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "user_id",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
              as: "user",
            },
          },
          {
            $unwind: {
              path: "$user",
              preserveNullAndEmptyArrays: true,
            },
          },

          {
            $lookup: {
              from: "admins",
              localField: "user_id",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
              as: "admin",
            },
          },
          {
            $unwind: {
              path: "$admin",
              preserveNullAndEmptyArrays: true,
            },
          },

          {
            $project: {
              type: 1,
              header: 1,
              message: 1,
              user: { $ifNull: ["$user", "$admin"] },
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ]);
        await Promise.map(allLogs, async (el, index) => {
          if (el.user.first_name)
            el.user.first_name = base64Decode(el.user.first_name);
          if (el.user.last_name)
            el.user.last_name = base64Decode(el.user.last_name);
        });
        return res.json(responseData("GET_LIST", allLogs, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  pdf_generate: async (req, res) => {
    try {
      var { id, mail } = req.query;
      let orderDetails = await Order.findOne({ order_id: +id })
        .populate("user_id", "email first_name last_name mobile country_code")
        .lean();
      if (!isEmpty(orderDetails)) {
        orderDetails.user_id.email = base64Decode(orderDetails.user_id.email);
        orderDetails.user_id.first_name = base64Decode(
          orderDetails.user_id.first_name
        );
        orderDetails.user_id.last_name = base64Decode(
          orderDetails.user_id.last_name
        );
        orderDetails.user_id.mobile = base64Decode(orderDetails.user_id.mobile);
        orderDetails.user_id.country_code = base64Decode(
          orderDetails.user_id.country_code
        );
        if (orderDetails?.address?.full_address != "" && orderDetails?.address?.full_address != null) 
          orderDetails.address.full_address = base64Decode(orderDetails?.address?.full_address);
        else 
          orderDetails.address.full_address = "";

        // const generateToken = () => {
        //   return Math.floor(Math.pow(10,12-1) + Math.random()* Math.pow(10,12)-Math.pow(10,12-1)-1)
        // }
        // const name = generateToken()

        const filePath = path.join(
          __dirname,
          `../../public/pdf/INV00${orderDetails.invoice_no}.pdf`
        );
        const url = `${process.env.API_URL}/pdf/INV00${orderDetails.invoice_no}.pdf`;
        var options = {
          format: "A3",
          orientation: "portrait",
          border: "10mm",
        };
        var document = {
          html: html,
          data: {
            orderDetail: orderDetails,
            item: orderDetails.items,
            date: moment(orderDetails.delivery_date).format("MMM DD, YYYY"),
            time: `(${moment(orderDetails.delivery_date).format(
              "hh:mm:ss A"
            )} - ${moment(orderDetails.delivery_time).format("hh:mm:ss A")})`,
            address: orderDetails.address.full_address,
          },
          path: filePath,
          type: "",
        };
        const attachment = [
          {
            filename: "Invoice_bill.pdf",
            path: `./public/pdf/INV00${orderDetails.invoice_no}.pdf`,
            contentType: "application/pdf",
          },
        ];
        await pdfGenerate(
          document,
          options,
          orderDetails.user_id.email,
          "Zoom Delivery App",
          `Your Invoice is generated.`,
          attachment,
          mail
        );
        return res.json(responseData("PDF_GENERATED", url, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      console.log("error", error);
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  order_cancel: async (req, res) => {
    try {
      var { id } = req.query;
      let order = await Order.findOne({
        _id: Types.ObjectId(id),
        is_cancelled: 0,
      })
        .populate("user_id", "first_name last_name email")
        .populate("store_id", "country_id")
        .lean();
      if (!isEmpty(order)) {
        if (order.user_id.first_name)
          order.user_id.first_name = base64Decode(order.user_id.first_name);
        if (order.user_id.last_name)
          order.user_id.last_name = base64Decode(order.user_id.last_name);
        if (order.user_id.email)
          order.user_id.email = base64Decode(order.user_id.email);
        const updateOrder = await Order.updateOne(
          { _id: Types.ObjectId(id) },
          { $set: { is_cancelled: 1 } },
          { new: true }
        );
        let { description, subject } =
          await email_service.getEmailTemplateBySlugAndCountry(
            "order-cancel",
            order.store_id.country_id
          );
        description = _.replace(
          description,
          "[Name]",
          `${order.user_id.first_name} ${order.user_id.last_name}`
        );
        description = _.replace(description, "[OrderId]", `${order.order_id}`);

        // sendEmail("lucky.kumawat@octalsoftware.com", subject, description);
        sendEmail(order.user_id.email, subject, description);
        return res.json(responseData("ORDER_CANCEL", {}, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  pending_order_export_data: async (req, res) => {
    try {
      const allOrder = await Order.aggregate([
        {
          $match: {
            delivery_status: 1,
            is_cancelled: 0,
            status: 0,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  role_id: 1,
                  first_name: 1,
                  last_name: 1,
                  email: 1,
                  mobile: 1,
                  notification_flag: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  name: 1,
                  country_name: { $ifNull: ["$country.name", ""] },
                  city_name: { $ifNull: ["$city.name", ""] },
                },
              },
            ],
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
            order_id: 1,
            invoice_no: 1,
            store_name: { $ifNull: ["$store.name", ""] },
            user_name: {
              $ifNull: [
                { $concat: ["$user.first_name", " ", "$user.last_name"] },
                "",
              ],
            },
            role: {
              $cond: [{ $eq: ["$user.role_id", 1] }, "Regular", "Wholeseller"],
            },
            product_name: {
              $map: { input: "$items", as: "item", in: "$$item.name" },
            },
            categories: {
              $map: { input: "$items", as: "item", in: "$$item.categories" },
            },
            brand: {
              $map: { input: "$items", as: "item", in: "$$item.brand" },
            },
            quantity: { $ifNull: ["$quantity", 0] },
            return_quantity: { $ifNull: ["$return_quantity", 0] },
            subtotal: { $ifNull: ["$subtotal", 0] },
            delivery_price: { $ifNull: ["$delivery_price", 0] },
            total: { $ifNull: ["$total", 0] },
            return_amount: { $ifNull: ["$return_amount", 0] },
            date: { $ifNull: ["$delivery_date", 0] },
            time: { $ifNull: ["$delivery_time", 0] },
            delivery_address: { $ifNull: ["$address.full_address", 0] },
            payment_mode: {
              $cond: [
                { $eq: ["$payment_mode", 1] },
                "Cash On Delivery",
                {
                  $cond: [
                    { $eq: ["$payment_mode", 2] },
                    "Card On Delivery",
                    {
                      $cond: [{ $eq: ["$payment_mode", 3] }, "Online", "None"],
                    },
                  ],
                },
              ],
            },
            payment_status: {
              $cond: [
                { $eq: ["$payment_status", 1] },
                "Paid",
                {
                  $cond: [
                    { $eq: ["$payment_status", 2] },
                    "Card On Delivery",
                    {
                      $cond: [
                        { $eq: ["$payment_status", 3] },
                        "Online",
                        "None",
                      ],
                    },
                  ],
                },
              ],
            },
            delivery_type: "Same Day",
            delivery_status: "Pending",
            order_note: { $ifNull: ["$note", ""] },
            createdAt: { $ifNull: ["$createdAt", ""] },
            country_name: { $ifNull: ["$store.country_name", ""] },
            city_name: { $ifNull: ["$store.city_name", ""] },
          },
        },
      ]);
      await Promise.map(allOrder, async (el, index) => {
        if (el.user_name) el.user_name = base64Decode(el.user_name);
        if (el.delivery_address)
          el.delivery_address = base64Decode(el.delivery_address);
        el.product_name = el.product_name.toString();
        el.categories = el.categories.toString();
        el.brand = el.brand.toString();
        el.brand = el.brand.toString();
        el.time = `${moment(el.date).format("hh:mm:ss A")}-${moment(
          el.time
        ).format("hh:mm:ss A")}`;
        el.date = moment(el.date).format("DD MMM, YYYY");
      });

      const fields = [
        {
          label: "Country",
          value: "country_name",
        },
        {
          label: "City",
          value: "city_name",
        },
        {
          label: "Order Id",
          value: "order_id",
        },
        // {
        //   label: 'Invoice Id',
        //   value: 'invoice_no'
        // },
        {
          label: "Store Name",
          value: "store_name",
        },
        {
          label: "Customer",
          value: "role",
        },
        {
          label: "Customer Name",
          value: "user_name",
        },
        {
          label: "Product Name",
          value: "product_name",
        },
        {
          label: "Categories",
          value: "categories",
        },
        {
          label: "Brands",
          value: "brand",
        },
        {
          label: "Quantity",
          value: "quantity",
        },
        {
          label: "Return Quantity",
          value: "return_quantity",
        },
        {
          label: "Net Amount",
          value: "subtotal",
        },
        {
          label: "delivery Charge",
          value: "delivery_price",
        },
        {
          label: "Total Amount",
          value: "total",
        },
        {
          label: "Return Amount",
          value: "return_amount",
        },
        {
          label: "Date",
          value: "date",
        },
        {
          label: "Time",
          value: "time",
        },
        {
          label: "Delivery Address",
          value: "delivery_address",
        },
        {
          label: "Payment Mode",
          value: "payment_mode",
        },
        {
          label: "Delivery Type",
          value: "delivery_type",
        },
        {
          label: "Delivery Status",
          value: "delivery_status",
        },
        {
          label: "Payment Status",
          value: "payment_status",
        },
        {
          label: "Order Note",
          value: "note",
        },
        {
          label: "Created At",
          value: "createdAt",
        },
      ];

      const json2csvParser = new Parser({ fields });
      const csv = fs.writeFile(
        "./public/csv/all_order_pending_list.csv",
        csv,
        function (err) {
          if (err) throw err;
          console.log("file saved");
          const path1 = `${process.env.API_URL}/csvFile/all_order_pending_list.csv`;
          return res.json(responseData("GET_CSV", { path: path1 }, req, true));
        }
      );
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  complete_order_export_data: async (req, res) => {
    try {
      const allOrder = await Order.aggregate([
        {
          $match: {
            delivery_status: 5,
            is_cancelled: 0,
            status: 0,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  role_id: 1,
                  first_name: 1,
                  last_name: 1,
                  email: 1,
                  mobile: 1,
                  notification_flag: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  name: 1,
                  country_name: { $ifNull: ["$country.name", ""] },
                  city_name: { $ifNull: ["$city.name", ""] },
                },
              },
            ],
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
            order_id: 1,
            invoice_no: 1,
            store_name: { $ifNull: ["$store.name", ""] },
            user_name: {
              $ifNull: [
                { $concat: ["$user.first_name", " ", "$user.last_name"] },
                "",
              ],
            },
            role: {
              $cond: [{ $eq: ["$user.role_id", 1] }, "Regular", "Wholeseller"],
            },
            product_name: {
              $map: { input: "$items", as: "item", in: "$$item.name" },
            },
            categories: {
              $map: { input: "$items", as: "item", in: "$$item.categories" },
            },
            brand: {
              $map: { input: "$items", as: "item", in: "$$item.brand" },
            },
            quantity: { $ifNull: ["$quantity", 0] },
            return_quantity: { $ifNull: ["$return_quantity", 0] },
            subtotal: { $ifNull: ["$subtotal", 0] },
            delivery_price: { $ifNull: ["$delivery_price", 0] },
            total: { $ifNull: ["$total", 0] },
            return_amount: { $ifNull: ["$return_amount", 0] },
            date: { $ifNull: ["$delivery_date", 0] },
            time: { $ifNull: ["$delivery_time", 0] },
            delivery_address: { $ifNull: ["$address.full_address", 0] },
            payment_mode: {
              $cond: [
                { $eq: ["$payment_mode", 1] },
                "Cash On Delivery",
                {
                  $cond: [
                    { $eq: ["$payment_mode", 2] },
                    "Card On Delivery",
                    {
                      $cond: [{ $eq: ["$payment_mode", 3] }, "Online", "None"],
                    },
                  ],
                },
              ],
            },
            payment_status: {
              $cond: [
                { $eq: ["$payment_status", 1] },
                "Paid",
                {
                  $cond: [
                    { $eq: ["$payment_status", 2] },
                    "Card On Delivery",
                    {
                      $cond: [
                        { $eq: ["$payment_status", 3] },
                        "Online",
                        "None",
                      ],
                    },
                  ],
                },
              ],
            },
            delivery_type: "Same Day",
            delivery_status: "Delivered",
            order_note: { $ifNull: ["$note", ""] },
            createdAt: { $ifNull: ["$createdAt", ""] },
            country_name: { $ifNull: ["$store.country_name", ""] },
            city_name: { $ifNull: ["$store.city_name", ""] },
          },
        },
      ]);
      await Promise.map(allOrder, async (el, index) => {
        if (el.user_name) el.user_name = base64Decode(el.user_name);
        if (el.delivery_address)
          el.delivery_address = base64Decode(el.delivery_address);
        el.product_name = el.product_name.toString();
        el.categories = el.categories.toString();
        el.brand = el.brand.toString();
        el.brand = el.brand.toString();
        el.time = `${moment(el.date).format("hh:mm:ss A")}-${moment(
          el.time
        ).format("hh:mm:ss A")}`;
        el.date = moment(el.date).format("DD MMM, YYYY");
      });

      const fields = [
        {
          label: "Country",
          value: "country_name",
        },
        {
          label: "City",
          value: "city_name",
        },
        {
          label: "Order Id",
          value: "order_id",
        },
        {
          label: "Invoice Id",
          value: "invoice_no",
        },
        {
          label: "Store Name",
          value: "store_name",
        },
        {
          label: "Customer",
          value: "role",
        },
        {
          label: "Customer Name",
          value: "user_name",
        },
        {
          label: "Product Name",
          value: "product_name",
        },
        {
          label: "Categories",
          value: "categories",
        },
        {
          label: "Brands",
          value: "brand",
        },
        {
          label: "Quantity",
          value: "quantity",
        },
        {
          label: "Return Quantity",
          value: "return_quantity",
        },
        {
          label: "Net Amount",
          value: "subtotal",
        },
        {
          label: "delivery Charge",
          value: "delivery_price",
        },
        {
          label: "Total Amount",
          value: "total",
        },
        {
          label: "Return Amount",
          value: "return_amount",
        },
        {
          label: "Date",
          value: "date",
        },
        {
          label: "Time",
          value: "time",
        },
        {
          label: "Delivery Address",
          value: "delivery_address",
        },
        {
          label: "Payment Mode",
          value: "payment_mode",
        },
        {
          label: "Delivery Type",
          value: "delivery_type",
        },
        {
          label: "Delivery Status",
          value: "delivery_status",
        },
        {
          label: "Payment Status",
          value: "payment_status",
        },
        {
          label: "Order Note",
          value: "note",
        },
        {
          label: "Created At",
          value: "createdAt",
        },
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(allOrder);
      fs.writeFile(
        "./public/csv/all_order_complete_list.csv",
        csv,
        function (err) {
          if (err) throw err;
          console.log("file saved");
          const path1 = `${process.env.API_URL}/csvFile/all_order_complete_list.csv`;
          return res.json(responseData("GET_CSV", { path: path1 }, req, true));
        }
      );
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  earning_list_export_data: async (req, res) => {
    try {
      const allOrder = await Order.aggregate([
        {
          $match: {
            delivery_status: 5,
            payment_status: 1,
            is_cancelled: 0,
            status: 0,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  role_id: 1,
                  first_name: 1,
                  last_name: 1,
                  email: 1,
                  mobile: 1,
                  notification_flag: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  name: 1,
                  country_name: { $ifNull: ["$country.name", ""] },
                  city_name: { $ifNull: ["$city.name", ""] },
                },
              },
            ],
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
            order_id: 1,
            invoice_no: 1,
            store_name: { $ifNull: ["$store.name", ""] },
            user_name: {
              $ifNull: [
                { $concat: ["$user.first_name", " ", "$user.last_name"] },
                "",
              ],
            },
            role: {
              $cond: [{ $eq: ["$user.role_id", 1] }, "Regular", "Wholeseller"],
            },
            product_name: {
              $map: { input: "$items", as: "item", in: "$$item.name" },
            },
            categories: {
              $map: { input: "$items", as: "item", in: "$$item.categories" },
            },
            brand: {
              $map: { input: "$items", as: "item", in: "$$item.brand" },
            },
            quantity: { $ifNull: ["$quantity", 0] },
            return_quantity: { $ifNull: ["$return_quantity", 0] },
            subtotal: { $ifNull: ["$subtotal", 0] },
            delivery_price: { $ifNull: ["$delivery_price", 0] },
            total: { $ifNull: ["$total", 0] },
            return_amount: { $ifNull: ["$return_amount", 0] },
            date: { $ifNull: ["$delivery_date", 0] },
            time: { $ifNull: ["$delivery_time", 0] },
            delivery_address: { $ifNull: ["$address.full_address", 0] },
            payment_mode: {
              $cond: [
                { $eq: ["$payment_mode", 1] },
                "Cash On Delivery",
                {
                  $cond: [
                    { $eq: ["$payment_mode", 2] },
                    "Card On Delivery",
                    {
                      $cond: [{ $eq: ["$payment_mode", 3] }, "Online", "None"],
                    },
                  ],
                },
              ],
            },
            payment_status: {
              $cond: [
                { $eq: ["$payment_status", 1] },
                "Paid",
                {
                  $cond: [
                    { $eq: ["$payment_status", 2] },
                    "Card On Delivery",
                    {
                      $cond: [
                        { $eq: ["$payment_status", 3] },
                        "Online",
                        "None",
                      ],
                    },
                  ],
                },
              ],
            },
            createdAt: { $ifNull: ["$createdAt", ""] },
            vat: { $ifNull: ["$vat", ""] },
            transaction_id: { $ifNull: ["$transaction_id", ""] },
            total_margin: { $ifNull: ["$total_margin", ""] },
            country_name: { $ifNull: ["$store.country_name", ""] },
            city_name: { $ifNull: ["$store.city_name", ""] },
          },
        },
      ]);
      await Promise.map(allOrder, async (el, index) => {
        if (el.user_name) el.user_name = base64Decode(el.user_name);
        if (el.delivery_address)
          el.delivery_address = base64Decode(el.delivery_address);
        el.product_name = el.product_name.toString();
        el.categories = el.categories.toString();
        el.brand = el.brand.toString();
        el.brand = el.brand.toString();
        el.time = `${moment(el.date).format("hh:mm:ss A")}-${moment(
          el.time
        ).format("hh:mm:ss A")}`;
        el.date = moment(el.date).format("DD MMM, YYYY");
      });

      const fields = [
        {
          label: "Country",
          value: "country_name",
        },
        {
          label: "City",
          value: "city_name",
        },
        {
          label: "Order Id",
          value: "order_id",
        },
        // {
        //   label: 'Invoice Id',
        //   value: 'invoice_no'
        // },
        {
          label: "Store Name",
          value: "store_name",
        },
        {
          label: "Customer Name",
          value: "user_name",
        },
        {
          label: "Customer",
          value: "role",
        },
        {
          label: "Product Name",
          value: "product_name",
        },
        {
          label: "Categories",
          value: "categories",
        },
        {
          label: "Brands",
          value: "brand",
        },
        {
          label: "Total Quantity",
          value: "quantity",
        },
        {
          label: "Return Quantity",
          value: "return_quantity",
        },
        {
          label: "Transaction Id",
          value: "transaction_id",
        },
        {
          label: "Net Amount",
          value: "subtotal",
        },
        {
          label: "delivery Charge",
          value: "delivery_price",
        },
        {
          label: "VAT",
          value: "vat",
        },
        {
          label: "Total Amount",
          value: "total",
        },
        {
          label: "Return Amount",
          value: "return_amount",
        },
        {
          label: "Margin",
          value: "total_margin",
        },
        {
          label: "Delivery Address",
          value: "delivery_address",
        },
        {
          label: "Payment Mode",
          value: "payment_mode",
        },
        {
          label: "Delivery Type",
          value: "delivery_type",
        },
        {
          label: "Delivery Status",
          value: "delivery_status",
        },
        {
          label: "Payment Status",
          value: "payment_status",
        },
        {
          label: "Created At",
          value: "createdAt",
        },
        {
          label: "delivery Date",
          value: "date",
        },
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(allOrder);
      fs.writeFile("./public/csv/earning_list.csv", csv, function (err) {
        if (err) throw err;
        console.log("file saved");
        const path1 = `${process.env.API_URL}/csvFile/earning_list.csv`;
        return res.json(responseData("GET_CSV", { path: path1 }, req, true));
      });
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  all_orders_by_driver: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        city_id,
        country_id,
        driver_id,
        status,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        status: 0,
        is_cancelled: 0,
        delivery_status: { $ne: 0 },
        driver_id: Types.ObjectId(driver_id),
      };
      var match2 = {};

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (keyword) {
        keyword = base64Encode(keyword);
        match2["$or"] = [
          { "user.first_name": { $regex: keyword, $options: "i" } },
          { "user.last_name": { $regex: keyword, $options: "i" } },
        ];
      }

      if (status) {
        match["delivery_status"] = status;
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      if (product_id) {
        match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      }

      if (order_id) {
        match["order_id"] = Number(order_id);
      }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                  is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            order_id: 1,
            invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            "user.is_credit_user": 1,
            items: 1,
            total_margin: 1,
            total_taxable: 1,
            transaction_id: 1,
            special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            note: 1,
            // driver_id: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            driver: { $ifNull: ["$driver", {}] },
            // deliveryBoyList: 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);

        if (el?.address?.full_address != "" && el?.address?.full_address != null) 
          el.address.full_address = base64Decode(el?.address?.full_address);
        else 
          el.address.full_address = "";

        if (el?.address?.zip_code != "" && el?.address?.zip_code != null) 
          el.address.zip_code = base64Decode(el?.address?.zip_code);
        else 
          el.address.zip_code = "";   

        if (el?.driver) {
          if (el?.driver?.first_name)
            el.driver.first_name = base64Decode(el?.driver?.first_name);
          if (el?.driver?.last_name)
            el.driver.last_name = base64Decode(el?.driver?.last_name);
        }
        el.delivery_slot = `${moment(el.delivery_date).format(
          "hh:mm:ss"
        )}-${moment(el.delivery_time).format("hh:mm:ss")}`;
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  total_unplaced_orders: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        city_id,
        country_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        status: 1,
        delivery_status: 0,
      };
      var match2 = {};

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      // if (product_id) {
      //   match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      // }

      // if (order_id) {
      //   match["order_id"] = Number(order_id);
      // }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  email: 1,
                  mobile: 1,
                  createdAt: 1,
                  device_type: 1,
                  role_id: 1,
                  device_type: 1,
                  // is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            user: 1,
            address: { $ifNull: ["$address.full_address", ""] },
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            items: 1,
            delivery_type: 1,
            total: 1,
            quantity: 1,
            createdAt: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        if (el?.user?.first_name)
          el.user.first_name = base64Decode(el.user.first_name);
        if (el?.user?.last_name)
          el.user.last_name = base64Decode(el.user.last_name);
        if (el?.user?.email) el.user.email = base64Decode(el.user.email);
        if (el?.user?.mobile) el.user.mobile = base64Decode(el.user.mobile);
        if (el?.address) el.mobile = base64Decode(el.address);
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  total_orders: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        city_id,
        country_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        delivery_status: { $in: [1, 2, 3, 4, 5] },
      };
      var match2 = {};

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      if (keyword) {
        keyword = base64Encode(keyword);
        match2["$or"] = [
          { "user.first_name": { $regex: keyword, $options: "i" } },
          { "user.last_name": { $regex: keyword, $options: "i" } },
        ];
      }

      if (product_id) {
        match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      }

      if (order_id) {
        match["order_id"] = Number(order_id);
      }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                  is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            order_id: 1,
            invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            "user.is_credit_user": 1,
            items: 1,
            total_margin: 1,
            total_taxable: 1,
            // transaction_id: 1,
            special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            note: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            driver: { $ifNull: ["$driver", {}] },
            // deliveryBoyList: 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        if (el?.address?.zip_code != "" && el?.address?.zip_code != null)
          el.address.zip_code = base64Decode(el.address.zip_code);
          else 
          el.address.zip_code = "";
        if (el?.deliveryBoyList) {
          await Promise.map(el?.deliveryBoyList, async (dl, index) => {
            dl.first_name = base64Decode(dl.first_name);
            dl.last_name = base64Decode(dl.last_name);
          });
        }
        if (el?.driver) {
          if (el?.driver?.first_name)
            el.driver.first_name = base64Decode(el?.driver?.first_name);
          if (el?.driver?.last_name)
            el.driver.last_name = base64Decode(el?.driver?.last_name);
        }
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  total_open_orders: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        city_id,
        country_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        delivery_status: { $nin: [0, 5] },
      };
      var match2 = {};

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      if (product_id) {
        match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      }

      if (keyword) {
        keyword = base64Encode(keyword);
        match2["$or"] = [
          { "user.first_name": { $regex: keyword, $options: "i" } },
          { "user.last_name": { $regex: keyword, $options: "i" } },
        ];
      }

      if (order_id) {
        match["order_id"] = Number(order_id);
      }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                  is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            // order_id: 1,
            // invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            "user.is_credit_user": 1,
            items: 1,
            total_margin: 1,
            total_taxable: 1,
            // transaction_id: 1,
            special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            note: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            driver: { $ifNull: ["$driver", {}] },
            // deliveryBoyList: 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        if (el?.address?.zip_code)
          el.address.zip_code = base64Decode(el.address.zip_code);
        else 
          el.address.zip_code = "";
        if (el?.deliveryBoyList) {
          await Promise.map(el?.deliveryBoyList, async (dl, index) => {
            dl.first_name = base64Decode(dl.first_name);
            dl.last_name = base64Decode(dl.last_name);
          });
        }
        if (el?.driver) {
          if (el?.driver?.first_name)
            el.driver.first_name = base64Decode(el?.driver?.first_name);
          if (el?.driver?.last_name)
            el.driver.last_name = base64Decode(el?.driver?.last_name);
        }
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  average_bucket: async (req, res) => {
    try {
      let {
        page,
        limit,
        sort_by,
        keyword,
        store_id,
        brand,
        category,
        sort_type,
        product_id,
        start_date,
        end_date,
        payment_mode,
        delivery_status,
        payment_status,
        order_id,
        city_id,
        country_id,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {
        delivery_status: 3,
      };
      var match2 = {};

      if (country_id) {
        match2["store.country._id"] = Types.ObjectId(country_id);
      }

      if (city_id) {
        match2["store.city._id"] = Types.ObjectId(city_id);
      }

      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }

      if (payment_mode) {
        match.payment_mode = Number(payment_mode);
      }

      if (delivery_status) {
        match.delivery_status = Number(delivery_status);
      }

      if (payment_status) {
        match.payment_status = Number(payment_status);
      }

      // if (product_id) {
      //   match2["$or"] = [{ "items.id": Types.ObjectId(product_id) }];
      // }

      // if (order_id) {
      //   match["order_id"] = Number(order_id);
      // }

      if (category) {
        match["items.categories"] = { $in: [category] };
        match2["items.categories"] = { $in: [category] };
      }

      if (brand) {
        match["items.brand"] = brand;
        match2["items.brand"] = brand;
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: new Date(end_date),
        };
      }
      // console.log(match);
      const query = Order.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                  role_id: 1,
                  is_credit_user: { $ifNull: ["$is_credit_user", 0] },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { alpha_code: 1, name: 1 } }],
                  as: "country",
                },
              },
              {
                $unwind: { path: "$country", preserveNullAndEmptyArrays: true },
              },
              {
                $lookup: {
                  from: "cities",
                  localField: "city_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1 } }],
                  as: "city",
                },
              },
              { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
              { $project: { name: 1, country: 1, city: 1 } },
            ],
            as: "store",
          },
        },
        {
          $unwind: "$store",
        },
        {
          $lookup: {
            from: "users",
            localField: "store_id",
            foreignField: "store_id",
            pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1 } }],
            as: "deliveryBoyList",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "driver_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
            ],
            as: "driver",
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $match: match2,
        },
        {
          $project: {
            _id: 1,
            // order_id: 1,
            // invoice_no: 1,
            "store._id": 1,
            "store.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
            "user.role_id": 1,
            "user.is_credit_user": 1,
            items: 1,
            total_margin: 1,
            total_taxable: 1,
            // transaction_id: 1,
            special_instruction: 1,
            return_quantity: 1,
            return_amount: 1,
            quantity: 1,
            subtotal: 1,
            vat: 1,
            vat_inclusive: 1,
            total: 1,
            note: 1,
            delivery_status: 1,
            delivery_type: 1,
            delivery_date: 1,
            delivery_time: 1,
            delivery_price: 1,
            delivery_message: 1,
            gift_card_price: 1,
            gift_card_message: 1,
            placedAt: 1,
            payment_status: 1,
            payment_mode: 1,
            post_code: 1,
            note: 1,
            driver: { $ifNull: ["$driver", {}] },
            // deliveryBoyList: 1,
            country: { $ifNull: ["$store.country", {}] },
            city: { $ifNull: ["$store.city", {}] },
            discount: 1,
            status: 1,
            offer: 1,
            address: 1,
            address_id: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Order.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        if (el?.address?.zip_code != "" && el?.address?.zip_code != null)
          el.address.zip_code = base64Decode(el.address.zip_code);
        else 
          el.address.zip_code = "";
        if (el?.deliveryBoyList) {
          await Promise.map(el?.deliveryBoyList, async (dl, index) => {
            dl.first_name = base64Decode(dl.first_name);
            dl.last_name = base64Decode(dl.last_name);
          });
        }
        if (el?.driver) {
          if (el?.driver?.first_name)
            el.driver.first_name = base64Decode(el?.driver?.first_name);
          if (el?.driver?.last_name)
            el.driver.last_name = base64Decode(el?.driver?.last_name);
        }
      });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_order: async (req, res) => {
    try {
      var { id, status } = req.params;
      status = parseInt(status);
      var orderDetails = await Order.findOne({
        _id: Types.ObjectId(id),
      })
        .populate("user_id", "is_credit_user")
        .lean();

      // if (status == orderDetails.delivery_status) {
      //   return res.json(
      //     responseData("ORDER_STATUS_UPDATED", orderDetails, req, true)
      //   );
      // }
      if (status == 5) {
        if (orderDetails.user_id.is_credit_user == 0) {
          // if user credit = 0 then will generate invoice when payment is received right now.

          const invoice_no_details = await Order.aggregate([
            { $match: { invoice_no: { $ne: "" } } },
            {
              $group: {
                _id: null,
                invoice_no: { $max: "$invoice_no" },
              },
            },
          ]);

          if (invoice_no_details.length > 0) {
            if (invoice_no_details[0].invoice_no) {
              var invoice_no = parseInt(invoice_no_details[0].invoice_no);

              invoice_no = invoice_no + 1;
            } else {
              invoice_no = 1;
            }
          } else {
            invoice_no = 1;
          }
          var order = await Order.findByIdAndUpdate(
            { _id: Types.ObjectId(id) },
            {
              $set: {
                delivery_status: status,
                invoice_no: invoice_no,
                payment_status: 1,
              },
            },
            { new: true }
          );
          // true means send invoice instead of confirmation email.
          await sendOrderConfirmationEmail(id, true);
        } else {
          // if delivered and is credit = 1 then we will not generate invoice no and payment status from here.
          var order = await Order.findByIdAndUpdate(
            { _id: Types.ObjectId(id) },
            { $set: { delivery_status: status } },
            { new: true }
          );
        }
      } else {
        var order = await Order.findByIdAndUpdate(
          { _id: Types.ObjectId(id) },
          { $set: { delivery_status: status } },
          { new: true }
        );
      }

      var statusText = "";
      if (status == 4) {
        statusText = " Admin updated to Out of Delivery.";
      } else if (status == 5) {
        statusText = " Admin updated to Delivered.";
      }
      addLog(
        req.user._id,
        "Order Status Updated",
        "#" + orderDetails.order_id,
        "Order Status Changed for order id #" +
          orderDetails.order_id +
          " " +
          statusText,
        Types.ObjectId(orderDetails._id)
      );

      sendNotificationOrderStatusChange(id);
      if (!isEmpty(order)) {
        return res.json(responseData("ORDER_STATUS_UPDATED", order, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
