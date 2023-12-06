const Product = require("../../models/product.model");
const User = require("../../models/user.model");
const Order = require("../../models/order.model");
const moment = require("moment");
var { isEmpty } = require("lodash");
const { Types } = require("mongoose");
const { responseData } = require("../../helpers/responseData");

module.exports = {
  dashboard: async (req, res) => {
    try {
      let { country_id, user_type, user_device_type, sale_data_type, complete_order_type, placed_order_type, sale_type, margin_type, unpaid_type, unpaid_start_date, unpaid_end_date, top10_type, top10_start_date, top10_end_date } = req.query

      let match = {};
      let match2 = {};

      let user_match = { role_id: { $in: [1,2] } };
      let sale_data_match = {};
      let complete_order_match = {};
      let placed_order_match = {};
      let sale_order_match = {};
      let margin_order_match = {};
      let unpaid_order_match = {};
      let top10_product_match = {};
      let top10_product_match2 = {};
      if (country_id) match.country_id = Types.ObjectId(country_id);
      if (country_id) match2['user.country_id'] = Types.ObjectId(country_id);

      // User match condition
      if (user_type) user_match['role_id'] = +user_type;
      if (user_device_type) user_match['device_type'] = new RegExp(['^', user_device_type, '$'].join(''), 'i');
      if (country_id) user_match['country_id'] = Types.ObjectId(country_id);
      // Sale Data Order match condition
      if (sale_data_type) sale_data_match['user.role_id'] = +sale_data_type;
      if (country_id) sale_data_match['store.country_id'] = Types.ObjectId(country_id);
      // Complete Order match condition
      if (complete_order_type) complete_order_match['user.role_id'] = +complete_order_type;
      if (country_id) complete_order_match['store.country_id'] = Types.ObjectId(country_id);
      // Placed Order match condition
      if (placed_order_type) placed_order_match['user.role_id'] = +placed_order_type;
      if (country_id) placed_order_match['store.country_id'] = Types.ObjectId(country_id);
      // Sale Order match condition
      if (sale_type) sale_order_match['user.role_id'] = +sale_type;
      if (country_id) sale_order_match['store.country_id'] = Types.ObjectId(country_id);
      // Margin Order match condition
      if (margin_type) margin_order_match['user.role_id'] = +margin_type;
      if (country_id) margin_order_match['store.country_id'] = Types.ObjectId(country_id);
      // Unpaid Order match condition
      if (unpaid_type) unpaid_order_match['user.role_id'] = +unpaid_type;
      if (country_id) unpaid_order_match['store.country_id'] = Types.ObjectId(country_id);
      if (unpaid_end_date) {
        unpaid_end_date = moment(unpaid_end_date).endOf("day");
      }

      if (unpaid_start_date && unpaid_end_date) {
        unpaid_order_match.createdAt = {
          $gte: new Date(unpaid_start_date),
          $lte: new Date(unpaid_end_date),
        };
      } else if (unpaid_start_date && !unpaid_end_date) {
        unpaid_order_match.createdAt = {
          $gte: new Date(unpaid_start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!unpaid_start_date && unpaid_end_date) {
        unpaid_order_match.createdAt = {
          $lte: new Date(unpaid_end_date),
        };
      }
      // Top 10 Product match condition
      if (top10_type) top10_product_match['role_id'] = +top10_type;
      if (country_id) top10_product_match['country_id'] = Types.ObjectId(country_id);
      if (top10_end_date) {
        top10_end_date = moment(top10_end_date).endOf("day");
      }

      if (top10_start_date && top10_end_date) {
        top10_product_match2['createdAt'] = {
          $gte: new Date(top10_start_date),
          $lte: new Date(top10_end_date),
        };
      } else if (top10_start_date && !top10_end_date) {
        top10_product_match2['createdAt'] = {
          $gte: new Date(top10_start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!top10_start_date && top10_end_date) {
        top10_product_match2['createdAt'] = {
          $lte: new Date(top10_end_date),
        };
      }


      // Total Users
      const totalRegularCustomer = await User.countDocuments({ ...match, role_id: 1 });
      const totalWholesellerCustomer = await User.countDocuments({ ...match, role_id: 2 });
      const totalDriver = await User.countDocuments({ ...match, role_id: 3 });

      // Order
      const totalUnPlacedOrders = (await Order.aggregate([{ $match: { delivery_status: 0, status: 1 } }, { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } }, { $match: match2 }])).length;
      const totalCompletedOrders = (await Order.aggregate([{ $match: { delivery_status: 5, is_cancelled: 0 } }, { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } }, { $match: match2 }])).length;
      const totalOrders = (await Order.aggregate([{ $match: { delivery_status: { $in: [1, 2, 3, 4, 5] } } }, { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } }, { $match: match2 }])).length;
      const totalProducts = await Product.countDocuments({ ...match });
      const top20Users = (await Order.aggregate([
        { $match: { delivery_status: 5 } }, 
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', pipeline: [{ $project: { _id: 1, country_id: 1 }}], as: 'user'}},
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true }},
        { $match: match2 },
        { $group: { _id: "$user._id", quantity: { $sum: "$quantity" }} }, 
        { $sort: { quantity: -1 } }, 
        { $limit: 20 }
      ])).length;
      const totalOpenOrders = (await Order.aggregate([{ $match: { delivery_status: {$nin: [0,5]} }}, { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } }, { $match: match2 }])).length;
      const avg_bucket = (await Order.aggregate([{ $match: { delivery_status: 3 } },{ $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } }, { $match: match2 }, { $group: { _id: 0, sum: {$sum: 1}} }]))[0];
      const totalProductOutOfStockCustomer = (await Product.aggregate([{ $match: { quantity_c: {$lte: 10} }}, { $group: { _id: 0, sum: {$sum: "$quantity_c"}}}]))[0];
      const totalProductOutOfStockWholesale = (await Product.aggregate([{ $match: { quantity_w: {$lte: 10} }}, { $group: { _id: 0, sum: {$sum: "$quantity_w"}}}]))[0];

      // User Registered Graph ----------------------------------------------------------------------
      var userGraph = {};

      // get dashboard graph data ==>>>> monthly
      const s_date = new Date(new Date().setMonth(new Date().getMonth() - 11))
      const g_date = new Date()
      var zeroth = (g_date.getMonth() + 1) >= 10 ? '' : '0'
      var zeroth1 = (s_date.getMonth() + 1) >= 10 ? '' : '0'
      const startedYear = new Date(`${s_date.getFullYear()}-${zeroth1 + (s_date.getMonth() + 1)}-01T00:00:02.022Z`);
      const endYear = new Date(`${g_date.getFullYear()}-${zeroth + (g_date.getMonth() + 1)}-31T23:59:59.022Z`);

      const monthlyEarnData = await User.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              is_mobile_verified: 1,
              ...user_match
            },
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              numberofuser: { $sum: 1 },
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArr = []
      let date = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date.getMonth() + 1
        let year = date.getFullYear()
        let data = monthlyEarnData.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArr.push(data)
        } else {
          monthArr.push({ "_id": { "x": month, "y": year }, "numberofuser": 0 })
        }
        date.setMonth(date.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly

      function getGraphDaysList(g_getDate, g_setDate) {
        var arr = []

        let counter1 = `${g_setDate.getFullYear()}-${g_setDate.getMonth() + 1}-${g_setDate.getDate()}`;
        let counter2 = `${g_getDate.getFullYear()}-${g_getDate.getMonth() + 1}-${g_getDate.getDate()}`;

        while (counter1 <= counter2) {
          arr.push({ date: `${g_setDate.getFullYear()}-${g_setDate.getMonth() + 1}-${g_setDate.getDate()}`, dateNo: g_setDate.getDate() })
          g_setDate.setDate(g_setDate.getDate() + 1)
          counter1 = `${g_setDate.getFullYear()}-${g_setDate.getMonth() + 1}-${g_setDate.getDate()}`;
        }
        return arr

      }

      let getDateWeekly = new Date(new Date().setDate(new Date().getDate() - 6));
      let getTodayDate = new Date();
      var zeroth = (getTodayDate.getMonth() + 1) >= 10 ? '' : '0';
      var zeroth1 = (getDateWeekly.getMonth() + 1) >= 10 ? '' : '0';
      var date_zero1 = (getTodayDate.getDate()) >= 10 ? '' : '0';
      var date_zero2 = (getDateWeekly.getDate()) >= 10 ? '' : '0';
      var startDate = new Date(`${getDateWeekly.getFullYear()}-${zeroth1 + (getDateWeekly.getMonth() + 1)}-${date_zero2 + (getDateWeekly.getDate())}T00:00:02.022Z`);
      var endDate = new Date(`${getTodayDate.getFullYear()}-${zeroth + (getTodayDate.getMonth() + 1)}-${date_zero1 + (getTodayDate.getDate())}T23:59:59.022Z`);

      const weeklyEarnData = await User.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              is_mobile_verified: 1,
              ...user_match
            },
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              numberofuser: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReport = []
      for (const day of daysList) {
        const findDays = weeklyEarnData.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReport.push({ date: day.date, noOfUser: findDays.numberofuser })
        } else {
          daysEarnReport.push({ date: day.date, noOfUser: 0 })
        }
      }

      //bind aal graph data===>>>>
      userGraph.monthlyEarnReport = monthArr;
      userGraph.daysEarnReport = daysEarnReport


      // Sale Data Graph -----------------------------------------------------------------------

      var saleDataGraph = {};

      // get dashboard graph data ==>>>> monthly

      const monthlyEarnDataOrder = await Order.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: sale_data_match
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              total: { $sum: '$total' },
              total_taxable: { $sum: '$total_taxable' },
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArrOrder = []
      let date1 = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date1.getMonth() + 1
        let year = date1.getFullYear()
        let data = monthlyEarnDataOrder.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArrOrder.push(data)
        } else {
          monthArrOrder.push({ "_id": { "x": month, "y": year }, "total": 0, "total_taxable": 0 })
        }
        date1.setMonth(date1.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly

      const weeklyEarnDataOrder = await Order.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: sale_data_match
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              total: { $sum: '$total' },
              total_taxable: { $sum: '$total_taxable' },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList1 = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReportOrder = []
      for (const day of daysList1) {
        const findDays = weeklyEarnDataOrder.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReportOrder.push({ date: day.date, total: findDays.total, total_taxable: findDays.total_taxable })
        } else {
          daysEarnReportOrder.push({ date: day.date, total: 0, total_taxable: 0 })
        }
      }

      //bind sale graph data===>>>>
      saleDataGraph.monthlyEarnReport = monthArrOrder;
      saleDataGraph.daysEarnReport = daysEarnReportOrder


      // Complete Order Graph -----------------------------------------------------------------------

      var completeOrderGraph = {};

      // get dashboard graph data ==>>>> monthly
      const monthlyEarnDataCompleteOrder = await Order.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              delivery_status: 5,
              payment_status: 1
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: complete_order_match
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArrCompleteOrder = []
      let date2 = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date2.getMonth() + 1
        let year = date2.getFullYear()
        let data = monthlyEarnDataCompleteOrder.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArrCompleteOrder.push(data)
        } else {
          monthArrCompleteOrder.push({ "_id": { "x": month, "y": year }, "noOfOrder": 0 })
        }
        date2.setMonth(date2.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly
      const weeklyEarnDataCompleteOrder = await Order.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              delivery_status: 5,
              payment_status: 1
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: complete_order_match
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList2 = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReporCompletetOrder = []
      for (const day of daysList2) {
        const findDays = weeklyEarnDataCompleteOrder.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReporCompletetOrder.push({ date: day.date, noOfOrder: findDays.noOfOrder })
        } else {
          daysEarnReporCompletetOrder.push({ date: day.date, noOfOrder: 0 })
        }
      }

      //bind sale graph data===>>>>
      completeOrderGraph.monthlyEarnReport = monthArrCompleteOrder;
      completeOrderGraph.daysEarnReport = daysEarnReporCompletetOrder


      // Placed Order Graph ----------------------------------------------------------------------------------

      var placedOrderGraph = {};

      // get dashboard graph data ==>>>> monthly
      const monthlyEarnDataPlacedOrder = await Order.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              delivery_status: { $gt: 0 }
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: placed_order_match
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArrPlacedOrder = []
      let date3 = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date3.getMonth() + 1
        let year = date3.getFullYear()
        let data = monthlyEarnDataPlacedOrder.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArrPlacedOrder.push(data)
        } else {
          monthArrPlacedOrder.push({ "_id": { "x": month, "y": year }, "noOfOrder": 0 })
        }
        date3.setMonth(date3.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly
      const weeklyEarnDataPlacedOrder = await Order.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              delivery_status: { $gt: 0 }
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: placed_order_match
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList3 = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReporPlacedtOrder = []
      for (const day of daysList3) {
        const findDays = weeklyEarnDataPlacedOrder.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReporPlacedtOrder.push({ date: day.date, noOfOrder: findDays.noOfOrder })
        } else {
          daysEarnReporPlacedtOrder.push({ date: day.date, noOfOrder: 0 })
        }
      }

      //bind sale graph data===>>>>
      placedOrderGraph.monthlyEarnReport = monthArrPlacedOrder;
      placedOrderGraph.daysEarnReport = daysEarnReporPlacedtOrder



      // Sale Order Graph ----------------------------------------------------------------------------------

      var saleOrderGraph = {};

      // get dashboard graph data ==>>>> monthly

      const monthlyEarnDataSaleOrder = await Order.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: sale_order_match
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArrSaleOrder = []
      let date4 = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date4.getMonth() + 1
        let year = date4.getFullYear()
        let data = monthlyEarnDataSaleOrder.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArrSaleOrder.push(data)
        } else {
          monthArrSaleOrder.push({ "_id": { "x": month, "y": year }, "noOfOrder": 0 })
        }
        date4.setMonth(date4.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly
      const weeklyEarnDataSaleOrder = await Order.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: sale_order_match
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              noOfOrder: { $sum: 1 }
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList4 = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReportSaleOrder = []
      for (const day of daysList4) {
        const findDays = weeklyEarnDataSaleOrder.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReportSaleOrder.push({ date: day.date, noOfOrder: findDays.noOfOrder })
        } else {
          daysEarnReportSaleOrder.push({ date: day.date, noOfOrder: 0 })
        }
      }

      //bind sale graph data===>>>>
      saleOrderGraph.monthlyEarnReport = monthArrSaleOrder;
      saleOrderGraph.daysEarnReport = daysEarnReportSaleOrder


      // Margin Order Graph ----------------------------------------------------------------------------------

      var marginOrderGraph = {};

      // get dashboard graph data ==>>>> monthly

      const monthlyEarnDataMarginOrder = await Order.aggregate(
        [
          {
            $match: {
              $and: [
                { createdAt: { '$gte': startedYear } },
                { createdAt: { '$lte': endYear } },
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: margin_order_match
          },
          {
            $group: {
              _id: { x: { $month: '$createdAt' }, y: { $year: '$createdAt' } },
              total_margin: { $sum: '$total_margin' }
            },
          },
          {
            $sort: { '_id.y': 1, '_id.x': 1 },
          },
        ]
      );

      let monthArrMarginOrder = []
      let date5 = new Date(new Date().setMonth(new Date().getMonth() - 11))
      for (let i = 1; i <= 12; i++) {
        let month = date5.getMonth() + 1
        let year = date5.getFullYear()
        let data = monthlyEarnDataMarginOrder.find(x => x._id.y === year && x._id.x === month)
        if (!isEmpty(data)) {
          monthArrMarginOrder.push(data)
        } else {
          monthArrMarginOrder.push({ "_id": { "x": month, "y": year }, "total_margin": 0 })
        }
        date5.setMonth(date5.getMonth() + 1)
      }



      // get dashboard graph data ==>>>> weekly
      const weeklyEarnDataMarginOrder = await Order.aggregate(
        [
          {
            $match: {

              $and: [
                { createdAt: { $gte: startDate } },
                { createdAt: { $lte: endDate } }
              ],
              delivery_status: 5
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'store_id',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $match: margin_order_match
          },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              total_margin: { $sum: '$total_margin' }
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]
      );
      const daysList5 = await getGraphDaysList(new Date(), new Date(new Date().setDate(new Date().getDate() - 6)))

      const daysEarnReportMarginorder = []
      for (const day of daysList5) {
        const findDays = weeklyEarnDataMarginOrder.find(item => item._id == day.dateNo)
        if (!isEmpty(findDays)) {
          daysEarnReportMarginorder.push({ date: day.date, total_margin: findDays.total_margin })
        } else {
          daysEarnReportMarginorder.push({ date: day.date, total_margin: 0 })
        }
      }

      //bind sale graph data===>>>>
      marginOrderGraph.monthlyEarnReport = monthArrMarginOrder;
      marginOrderGraph.daysEarnReport = daysEarnReportMarginorder

      const unpaid_completed_orders = await Order.aggregate([
        {
          $match: { delivery_status: 5, payment_status: { $nin: [1] } }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'store_id',
            foreignField: '_id',
            as: 'store'
          }
        },
        {
          $match: unpaid_order_match
        },
        {
          $group: {
            _id: '$delivery_status',
            total: { $sum: '$total' },
            noOfOrder: { $sum: 1 }
          }
        }
      ])

      const top10Product = await Order.aggregate([
        {
          $match: {
            delivery_status: 5,
            ...top10_product_match2
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'store_id',
            foreignField: '_id',
            as: 'store'
          }
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
          $project: {
            placedAt: 1,
            store_id: 1,
            store: 1,
            user: 1,
            order_id: 1,
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
            // store_id: { $first: "$store._id" },
            role_id: { $first: "$user.role_id" },
            country_id: { $first: "$store.country_id" },
            // city_id: { $first: "$store.city_id" },
            name: { $first: "$items.name" },
            categories: { $first: "$items.categories" },
            brand: { $first: "$items.brand" },
            createdAt: { $first: '$createdAt'}
          },
        },
        {
          $match: top10_product_match
        },
        {
          $sort: { quantity: -1 }
        },
        {
          $limit: 10
        }
      ])



      const data = {
        totalRegularCustomer,
        totalWholesellerCustomer,
        totalDriver,
        totalUnPlacedOrders,
        totalOrders,
        totalCompletedOrders,
        top20Users,
        totalOpenOrders,
        avg_bucket: avg_bucket?.sum || 0,
        totalProductOutOfStock: totalProductOutOfStockCustomer?.sum + totalProductOutOfStockWholesale?.sum,
        // totalCompletedOrders,
        totalProducts,
        userGraph,
        saleDataGraph,
        completeOrderGraph,
        placedOrderGraph,
        saleGraph: saleOrderGraph,
        marginGraph: marginOrderGraph,
        unpaid_completed_orders,
        top10Product
      }
      return res.json(responseData("GET_LIST", data, req, true));
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
