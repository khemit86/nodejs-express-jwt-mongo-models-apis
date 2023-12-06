const express = require("express");
const router = express.Router();
const city = require("../../controllers/admins/city.controller");
const validationRule = require("../../validations/admins/admin");
const { verifyToken } = require("../../middlewares/verifyToken");

//get admin city list
router.get("/", city.list_city);
router.get("/get_cities", [verifyToken], city.get_cities);

//add admin city
router.post(
  "/",
  [verifyToken],
  validationRule.validate("addCity"),
  city.add_city
);
//edit admin city
router.put(
  "/edit-city",
  [verifyToken],
  validationRule.validate("editCity"),
  city.edit_city
);
//delete admin city
router.delete("/delete-city/:id", [verifyToken], city.delete_city);
//change admin city status
router.put("/change-status/:id", [verifyToken], city.change_status_city);

module.exports = router;
