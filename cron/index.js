"use strict";
var cron = require("node-cron");
var cron_service = require("../services/users/cron.services");
var sync_service = require("../services/admins/sync.services");

/**
 * For every 1 min
 */
cron.schedule("*/2 * * * *", () => {
  console.log("cron");
  //sync_service.importOrders();
});

cron.schedule("*/1 * * * *", () => {
  //console.log("cron");
  cron_service.sendNotification();
});

cron.schedule("*/1 * * * *", () => {
  // console.log("cron product_inventory");
  cron_service.product_inventory();
});
