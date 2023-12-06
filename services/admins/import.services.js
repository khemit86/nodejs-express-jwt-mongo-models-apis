const Product2 = require("../../models/productp.model");
const Product = require("../../models/product.model");
const Supplier = require("../../models/supplier.model");
const Brand = require("../../models/brand.model");
const VATCode = require("../../models/vat_code.model");
const Category = require("../../models/categoryp.model");
const SizeCode = require("../../models/sizecode.model");
const { responseData } = require("../../helpers/responseData");
const { getPath, saveFile, list_to_tree } = require("../../helpers/helper");
const ProductInventory = require("../../models/productinventoryy.model");
const {
  PRODUCT_IMPORT_FOLDER,
  INVENTORY_IMPORT_FOLDER,
  CATEGORY_IMPORT_FOLDER,
} = require("../../helpers/config");

const { Types } = require("mongoose");
const _ = require("lodash");
const xlsx = require("xlsx");
const Store = require("../../models/store.model");

module.exports = {
  importProduct: async (req, res) => {
    try {
      var { country_id } = req.body;
      const files = req.files;
      if (files && files.file) {
        if (
          files.file.mimetype !=
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be in XLSX format only.",
              req,
              false
            )
          );
        } else if (files.file.size > 10 * 1024 * 1024) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be less than 10MB size.",
              req,
              false
            )
          );
        }

        if (files.file.name != undefined) {
          var filename = await saveFile(
            files.file,
            PRODUCT_IMPORT_FOLDER,
            null
          );
          var csvFilePath = await getPath(PRODUCT_IMPORT_FOLDER, filename);

          const workbook = xlsx.readFile(csvFilePath);
          let workbook_sheet = workbook.SheetNames;
          var jsonArray = xlsx.utils.sheet_to_json(
            workbook.Sheets[workbook_sheet[0]],
            { defval: "" }
          );

          var match = {};
          match.country_id = Types.ObjectId(country_id);

          var allCategories = await Category.aggregate([
            { $match: match },
            {
              $project: {
                _id: 1,
                name: 1,
                status: 1,
              },
            },
            { $sort: { title: 1 } },
          ]);

          var allProducts = await Product2.find({
            country_id: Types.ObjectId(country_id),
            status: true,
          })
            .sort({ name: 1 })
            .select("sku _id images");
          var allSuppliers = await Supplier.find({
            country_id: Types.ObjectId(country_id),
            status: true,
          })
            .sort({ name: 1 })
            .select("name _id");

          var allBrands = await Brand.find({
            country_id: country_id,
            status: true,
          })
            .sort({ name: 1 })
            .select("name _id");

          var allVATCodes = await VATCode.find({
            country_id: country_id,
            status: true,
          })
            .sort({ name: 1 })
            .select("name _id");

          var allSizeCodes = await SizeCode.find({})
            .sort({ name: 1 })
            .select("name _id");

          var allRecords = [];
          if (jsonArray.length > 0) {
            for (let i = 0; i < jsonArray.length; i++) {
              var e = jsonArray[i];

              // xls library convert few string fields into integer value. so lets convert them in string always.
              e.Categories = e.Categories.toString();
              e.Brand = e.Brand.toString();
              e.Supplier = e.Supplier.toString();
              e.VAT = e.VAT.toString();
              e["Size Unit"] = e["Size Unit"].toString();
              e["QR Code"] = e["QR Code"].toString();
              e.Size = e.Size.toString();
              e.Name = e.Name.toString();
              e.SKU = e.SKU.toString();
              e["Product Description"] = e["Product Description"].toString();
              e["Product Information"] = e["Product Information"].toString();
              e["Image1"] = e["Image1"].toString();

              // trim all object properties.

              Object.keys(e).forEach(
                (k) => (e[k] = typeof e[k] == "string" ? e[k].trim() : e[k])
              );

              if (e["Price"] != "")
                e["Price"] = Number(parseFloat(e["Price"]).toFixed(2));
              if (e["Buy Price"] != "")
                e["Buy Price"] = Number(parseFloat(e["Buy Price"]).toFixed(2));
              if (e["Minimum Quantity For Wholesaler"] != "")
                e["Minimum Quantity For Wholesaler"] = Number(
                  parseFloat(e["Minimum Quantity For Wholesaler"]).toFixed(0)
                );
              if (e["Minimum Quantity (For Out Of Stock)"] != "")
                e["Minimum Quantity (For Out Of Stock)"] = Number(
                  parseFloat(e["Minimum Quantity (For Out Of Stock)"]).toFixed(
                    0
                  )
                );

              //jsonArray.forEach(async (e) => {
              var newRecord = {};
              newRecord.old = e;
              newRecord.country_id = Types.ObjectId(country_id);
              newRecord.categories = [];
              newRecord.brand_id = "";
              newRecord.supplier_id = "";
              newRecord.vat_code_id = "";
              newRecord.size_code_id = "";
              newRecord.name = "";
              newRecord.size = "";
              newRecord.price = "";
              newRecord.offer_price = "";
              newRecord.buy_price = "";
              newRecord.description = "";
              newRecord.product_info = "";
              newRecord.sku = "";
              newRecord.bar_code = "";
              newRecord.min_qty_stock = "";
              newRecord.minimum_quantity_for_wholesaler = "";
              newRecord.is_special = "";
              newRecord.offer_start_at = null;
              newRecord.offer_start_end = null;
              newRecord.w_discount_per = null;
              newRecord.w_offer_start_at = null;
              newRecord.w_offer_start_end = null;
              newRecord.images = [];
              newRecord.errors = [];
              newRecord.operation = "NONE";

              // Match category then assign category id.
              if (e.Categories != "") {
                let categories = e.Categories.split(",");
                if (categories.length > 0) {
                  categories.forEach((c) => {
                    let searchString = c.trim();
                    let matchedC = allCategories.find(
                      ({ name }) =>
                        name.toLowerCase() === searchString.toLowerCase()
                    );
                    if (matchedC != undefined) {
                      newRecord.categories.push(matchedC._id);
                    }
                  });
                }
              }
              // If category is not matched then assign error.
              if (newRecord.categories.length == 0) {
                newRecord.errors.push("Category does not matched.");
              }
              // Brand

              var searchString = e.Brand.trim();
              var matchedC = allBrands.find(
                ({ name }) => name.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                newRecord.brand_id = matchedC._id;
              } else {
                newRecord.errors.push("Brand does not matched.");
              }

              // Supplier

              var searchString = e.Supplier.trim();
              var matchedC = allSuppliers.find(
                ({ name }) => name.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                newRecord.supplier_id = matchedC._id;
              } else {
                newRecord.errors.push("Supplier does not matched.");
              }

              // allVATCodes

              var searchString = e.VAT.trim();
              var matchedC = allVATCodes.find(
                ({ name }) => name.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                newRecord.vat_code_id = matchedC._id;
              } else {
                newRecord.errors.push("VAT Code does not matched.");
              }

              // allSizeCodes

              var searchString = e["Size Unit"].trim();
              var matchedC = allSizeCodes.find(
                ({ name }) => name.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                newRecord.size_code_id = matchedC._id;
              } else {
                newRecord.errors.push("SIZE Code does not matched.");
              }
              if (e.Name != "") {
                newRecord.name = e.Name;
              } else {
                newRecord.errors.push("Name is required.");
              }
              if (e.Size != "") {
                newRecord.size = e.Size;
              } else {
                newRecord.errors.push("Size is required.");
              }

              if (e["Price"] == "" || _.isNaN(e["Price"])) {
                newRecord.errors.push("Price is required.");
              } else if (_.isNumber(e["Price"]) == false) {
                newRecord.errors.push("Invalid Price.");
              } else {
                newRecord.price = e["Price"];
              }

              if (e["Buy Price"] == "" || _.isNaN(e["Buy Price"])) {
                newRecord.errors.push("Buy Price is required.");
              } else if (_.isNumber(e["Buy Price"]) == false) {
                newRecord.errors.push("Invalid Buy Price.");
              } else {
                newRecord.buy_price = e["Buy Price"];
              }

              if (
                e["Minimum Quantity For Wholesaler"] == "" ||
                _.isNaN(e["Minimum Quantity For Wholesaler"])
              ) {
                newRecord.errors.push(
                  "Minimum Quantity For Wholesaler is required."
                );
              } else if (
                _.isNumber(e["Minimum Quantity For Wholesaler"]) == false
              ) {
                newRecord.errors.push(
                  "Invalid Minimum Quantity For Wholesaler."
                );
              } else {
                newRecord.buy_price = e["Minimum Quantity For Wholesaler"];
              }

              if (
                e["Minimum Quantity (For Out Of Stock)"] == "" ||
                _.isNaN(e["Minimum Quantity (For Out Of Stock)"])
              ) {
                newRecord.errors.push(
                  "Minimum Quantity (For Out Of Stock) is required."
                );
              } else if (
                _.isNumber(e["Minimum Quantity (For Out Of Stock)"]) == false
              ) {
                newRecord.errors.push(
                  "Invalid Minimum Quantity (For Out Of Stock)."
                );
              } else {
                newRecord.buy_price = e["Minimum Quantity (For Out Of Stock)"];
              }

              if (e["Product Description"] != "") {
                newRecord.description = e["Product Description"];
              } else {
                newRecord.errors.push("Product Description is required.");
              }
              if (e["Product Information"] != "") {
                newRecord.product_info = e["Product Information"];
              } else {
                newRecord.errors.push("Product Information is required.");
              }

              if (e["SKU"] != "") {
                newRecord.sku = e["SKU"];
              } else {
                newRecord.errors.push("SKU is required.");
              }
              if (e["QR Code"] != "") {
                newRecord.bar_code = e["QR Code"];
              } else {
                newRecord.errors.push("QR Code is required.");
              }

              if (e["Image1"] != "") {
                newRecord.images.push({
                  name: e["Image1"],
                  is_default: newRecord.images.length == 0 ? 1 : 0,
                });
              }

              if (newRecord.errors.length == 0) {
                // check if sku exists then update otherwise insert.
                var searchString = e["SKU"].trim();
                var matchedC = allProducts.find(
                  ({ sku }) => sku.toLowerCase() === searchString.toLowerCase()
                );
                if (matchedC != undefined) {
                  // update Product
                  //console.log("update");
                  // merge old and new images
                  let images = [...matchedC.images, ...newRecord.images];
                  let key = "name";
                  var imagesUniqueByKey = [
                    ...new Map(
                      images.map((item) => [item[key], item])
                    ).values(),
                  ]; // make them unique
                  imagesUniqueByKey.forEach((element, index) => {
                    if (index == 0) {
                      imagesUniqueByKey[index] = {
                        name: element.name,
                        default: 1,
                      };
                    } else {
                      imagesUniqueByKey[index] = {
                        name: element.name,
                        default: 0,
                      };
                    }
                  });

                  newRecord.operation = "RECORD UPDATED";

                  await Product2.updateOne(
                    {
                      country_id: newRecord.country_id,
                      sku: newRecord.sku,
                    },
                    {
                      categories: newRecord.categories,
                      brand_id: newRecord.brand_id,
                      supplier_id: newRecord.supplier_id,
                      vat_code_id: newRecord.vat_code_id,
                      size_code_id: newRecord.size_code_id,
                      name: newRecord.name,
                      size: newRecord.size,
                      price: newRecord.price,
                      buy_price: newRecord.buy_price,
                      description: newRecord.description,
                      product_info: newRecord.product_info,
                      bar_code: newRecord.bar_code,
                      min_qty_stock: newRecord.min_qty_stock,
                      minimum_quantity_for_wholesaler:
                        newRecord.minimum_quantity_for_wholesaler,
                      images: imagesUniqueByKey,
                    }
                  );
                } else {
                  // Insert Product
                  newRecord.operation = "RECORD INSERTED";
                  var product = await Product2.create({
                    country_id: newRecord.country_id,
                    categories: newRecord.categories,
                    brand_id: newRecord.brand_id,
                    supplier_id: newRecord.supplier_id,
                    vat_code_id: newRecord.vat_code_id,
                    size_code_id: newRecord.size_code_id,
                    name: newRecord.name,
                    size: newRecord.size,
                    price: newRecord.price,
                    offer_price: newRecord.offer_price,
                    buy_price: newRecord.buy_price,
                    description: newRecord.description,
                    product_info: newRecord.product_info,
                    sku: newRecord.sku,
                    bar_code: newRecord.bar_code,
                    min_qty_stock: newRecord.min_qty_stock,
                    minimum_quantity_for_wholesaler:
                      newRecord.minimum_quantity_for_wholesaler,
                    offer_start_at: newRecord.offer_start_at,
                    offer_start_end: newRecord.offer_start_end,
                    w_discount_per: newRecord.w_discount_per,
                    w_offer_start_at: newRecord.w_offer_start_at,
                    w_offer_start_end: newRecord.w_offer_start_end,
                    images: newRecord.images,
                  });
                  //console.log(product);
                  // after create product push this product in already created items

                  if (product._id) {
                    allProducts.push({
                      _id: product._id,
                      sku: product.sku,
                      images: product.images,
                    });
                  }

                  //return false;
                }
              }
              // delete unwanted keys

              allRecords.push({
                ...newRecord.old,
                errors: newRecord.errors.toString(),
                operation: newRecord.operation.toString(),
              });
            }
          }

          const ws = xlsx.utils.json_to_sheet(allRecords);
          const wb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(wb, ws, "Responses");
          xlsx.writeFile(
            wb,
            "./public/" + PRODUCT_IMPORT_FOLDER + "/ack_" + filename
          );
          const path1 = `${process.env.IMAGE_LOCAL_PATH}${PRODUCT_IMPORT_FOLDER}/ack_${filename}`;

          return res.json(
            responseData("PLEASE_DOWNLOAD_CSV_TO_SEE_REPORTS", path1, req, true)
          );
        }
      }
    } catch (error) {
      console.log(error);
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  importInventory: async (req, res) => {
    try {
      var { country_id } = req.body;
      let workbook_response = [];
      const files = req.files;
      var allRecords = [];
      if (files && files.file) {
        if (
          files.file.mimetype !=
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be in XLSX format only.",
              req,
              false
            )
          );
        } else if (files.file.size > 10 * 1024 * 1024) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be less than 10MB size.",
              req,
              false
            )
          );
        }

        if (files.file.name != undefined) {
          var filename = await saveFile(
            files.file,
            INVENTORY_IMPORT_FOLDER,
            null
          );
          var csvFilePath = await getPath(INVENTORY_IMPORT_FOLDER, filename);

          const workbook = xlsx.readFile(csvFilePath);
          let workbook_sheet = workbook.SheetNames;
          workbook_response = xlsx.utils.sheet_to_json(
            workbook.Sheets[workbook_sheet[0]],
            { defval: "" }
          );
          var match = {};
          match.country_id = Types.ObjectId(country_id);
          var allStores = await Store.aggregate([
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
            { $project: { _id: 1, name: 1, "city.name": 1, "city._id": 1 } },
            { $sort: { "city.name": 1, name: 1 } },
          ]);
          var allStoresRectified = [];
          if (allStores.length > 0) {
            allStores.forEach(async (e) => {
              allStoresRectified.push({
                name: e.city?.name + "@" + e?.name,
                _id: e.city?._id + "@" + e?._id,
              });
            });
          }
          var allProducts = await Product.find({
            country_id: Types.ObjectId(country_id),
            status: true,
          })
            .sort({ name: 1 })
            .select("sku _id");
          var element = "";
          if (workbook_response.length > 0) {
            for (let i = 0; i < workbook_response.length; i++) {
              element = workbook_response[i];
              // this excel library change string to numbers so string function does not worked but we need to work
              element.City = element.City.toString();
              element.Store = element.Store.toString();
              element.SKU = element.SKU.toString();

              Object.keys(element).forEach(
                (k) =>
                  (element[k] =
                    typeof element[k] == "string"
                      ? element[k].trim()
                      : element[k])
              ); // remove trim

              //
              var newRecord = {};
              newRecord.old = element;
              newRecord.user_id = req.user._id;
              newRecord.country_id = country_id;
              newRecord.city_id = "";
              newRecord.store_id = "";
              newRecord.product_id = "";
              newRecord.quantity_c = 0;
              newRecord.quantity_w = 0;
              newRecord.stolen_product_quantity = 0;
              newRecord.damaged_product_quantity = 0;
              newRecord.errors = [];
              newRecord.action = "";
              var searchString = element.City + "@" + element.Store;
              var matchedC = allStoresRectified.find(
                ({ name }) => name.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                let cityStore = matchedC?._id?.split("@");
                newRecord.city_id = Types.ObjectId(cityStore[0]);
                newRecord.store_id = Types.ObjectId(cityStore[1]);
              } else {
                newRecord.errors.push("City or Store Does Not Matched.");
              }

              var searchString = element["SKU"];
              var matchedC = allProducts.find(
                ({ sku }) => sku.toLowerCase() === searchString.toLowerCase()
              );
              if (matchedC != undefined) {
                newRecord.product_id = matchedC._id;
              } else {
                newRecord.errors.push("SKU does not matched.");
              }
              if (!_.isInteger(element["Quantity Customer"])) {
                newRecord.errors.push("Quantity Customer is invalid.");
              } else {
                newRecord.quantity_c = +element["Quantity Customer"];
              }
              if (!_.isInteger(element["Quantity Wholesale"])) {
                newRecord.errors.push("Quantity Wholesale is invalid.");
              } else {
                newRecord.quantity_w = +element["Quantity Wholesale"];
              }

              if (!_.isInteger(element["Stolen"])) {
                newRecord.errors.push("Stolen is invalid.");
              } else {
                newRecord.stolen_product_quantity = +element["Stolen"];
              }

              if (!_.isInteger(element["Damaged"])) {
                newRecord.errors.push("Damaged is invalid.");
              } else {
                newRecord.damaged_product_quantity = +element["Damaged"];
              }
              if (newRecord.errors.length == 0) {
                // insert

                var inventoryResult = await ProductInventory.create({
                  user_id: Types.ObjectId(newRecord.user_id),
                  country_id: Types.ObjectId(newRecord.country_id),
                  city_id: Types.ObjectId(newRecord.city_id),
                  store_id: Types.ObjectId(newRecord.store_id),
                  product_id: Types.ObjectId(newRecord.product_id),
                  quantity_c: newRecord.quantity_c,
                  quantity_w: newRecord.quantity_w,
                  stolen_product_quantity: newRecord.stolen_product_quantity,
                  damaged_product_quantity: newRecord.damaged_product_quantity,
                  sync: false,
                });

                newRecord.action = "INSERTED";
              } else {
                newRecord.action = "FAILED";
              }
              allRecords.push({
                ...newRecord.old,
                errors: newRecord.errors.toString(),
                operation: newRecord.action.toString(),
              });
            }
          }

          const ws = xlsx.utils.json_to_sheet(allRecords);
          const wb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(wb, ws, "Responses");
          xlsx.writeFile(
            wb,
            "./public/" + INVENTORY_IMPORT_FOLDER + "/ack_" + filename
          );
          const path1 = `${process.env.IMAGE_LOCAL_PATH}${INVENTORY_IMPORT_FOLDER}/ack_${filename}`;

          return res.json(
            responseData("PLEASE_DOWNLOAD_CSV_TO_SEE_REPORTS", path1, req, true)
          );
        }
      }
    } catch (error) {
      console.log(error);
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  importCategory: async (req, res) => {
    try {
      var { country_id } = req.body;
      let workbook_response = [];
      const files = req.files;
      var allRecords = [];
      if (files && files.file) {
        if (
          files.file.mimetype !=
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be in XLSX format only.",
              req,
              false
            )
          );
        } else if (files.file.size > 10 * 1024 * 1024) {
          return res.json(
            responseData(
              "ERROR_OCCUR",
              "File should be less than 10MB size.",
              req,
              false
            )
          );
        }

        if (files.file.name != undefined) {
          var filename = await saveFile(
            files.file,
            CATEGORY_IMPORT_FOLDER,
            null
          );
          var csvFilePath = await getPath(CATEGORY_IMPORT_FOLDER, filename);

          const workbook = xlsx.readFile(csvFilePath);
          let workbook_sheet = workbook.SheetNames;
          workbook_response = xlsx.utils.sheet_to_json(
            workbook.Sheets[workbook_sheet[0]],
            { defval: "" }
          );
          var match = {};
          match.country_id = Types.ObjectId(country_id);

          const allCategories = await Category.aggregate([
            { $match: match },
            {
              $project: {
                _id: 1,
                name: 1,
                status: 1,
                parent: { $ifNull: ["$parent", ""] },
              },
            },
            { $sort: { title: 1 } },
          ]);
          var allParents = [];
          var allChilds = [];
          //const ten='';
          const ten = await list_to_tree(allCategories);
          if (ten.length > 0) {
            ten.forEach((c) => {
              allParents.push({ parentId: c._id, parentName: c.name });
              if (c.children.length > 0) {
                c.children.forEach((c1) => {
                  allChilds.push({
                    parentId: c._id,
                    parentName: c.name,
                    id: c1._id,
                    name: c1.name,
                    jointer: c1.name + "@" + c.name,
                  });
                });
              }
            });
          }

          var element = "";
          if (workbook_response.length > 0) {
            for (let i = 0; i < workbook_response.length; i++) {
              element = workbook_response[i];
              // this excel library change strings to numbers so string function does not worked but we need to work

              element.Category = element.Category.toString();
              element.Parent = element.Parent.toString();
              element.Image = element.Image.toString();

              Object.keys(element).forEach(
                (k) =>
                  (element[k] =
                    typeof element[k] == "string"
                      ? element[k].trim()
                      : element[k])
              ); // remove trim

              //
              var newRecord = {};
              newRecord.old = element;
              newRecord.country_id = Types.ObjectId(country_id);
              newRecord.Category = element.Category;
              newRecord.Parent = element.Parent;
              newRecord.Image = element.Image;
              newRecord.errors = [];
              newRecord.action = "";
              // if parent is empty then check if this is no parent category we will create new one.
              if (newRecord.Category != "" && newRecord.Parent == "") {
                var searchString = newRecord.Category;
                var matchedC = allParents.find(
                  ({ parentName }) =>
                    parentName.toLowerCase() === searchString.toLowerCase()
                );
                if (matchedC != undefined) {
                  newRecord.errors.push("Category Name Already Exists");
                }
              } else if (newRecord.Category != "" && newRecord.Parent != "") {
                var searchString = newRecord.Category + "@" + newRecord.Parent;
                var matchedC = allChilds.find(
                  ({ jointer }) =>
                    jointer.toLowerCase() === searchString.toLowerCase()
                );
                if (matchedC != undefined) {
                  newRecord.errors.push("Category Name Already Exists");
                }
              }

              if (newRecord.errors.length == 0) {
                // if parent is empty then check if this is no parent category we will create new one.
                if (newRecord.Category != "" && newRecord.Parent == "") {
                  var product = await Category.create({
                    country_id: newRecord.country_id,
                    name: newRecord.Category,
                    image: newRecord.Image,
                  });
                  allParents.push({
                    parentId: product._id,
                    parentName: "",
                  });
                } else {
                  // get parent category
                  var checkParent = await Category.findOne(
                    {
                      country_id: newRecord.country_id,
                      name: newRecord.Parent,
                      parent: { $exists: false },
                    },
                    {
                      _id: 1,
                    }
                  ).lean();
                  // create and get parent category
                  if (checkParent == null) {
                    checkParent = await Category.create({
                      country_id: newRecord.country_id,
                      name: newRecord.Parent,
                      image: newRecord.Image,
                    });
                  }
                  // create child under same parent
                  var checkChild = await Category.findOne(
                    {
                      country_id: newRecord.country_id,
                      name: newRecord.Category,
                      parent: Types.ObjectId(checkParent._id),
                    },
                    {
                      _id: 1,
                    }
                  ).lean();
                  if (checkChild == null) {
                    checkChild = await Category.create({
                      country_id: newRecord.country_id,
                      name: newRecord.Category,
                      image: newRecord.Image,
                      parent: Types.ObjectId(checkParent._id),
                    });
                  }
                }
                newRecord.action = "INSERTED";
              } else {
                newRecord.action = "FAILED";
              }
              allRecords.push({
                ...newRecord.old,
                errors: newRecord.errors.toString(),
                operation: newRecord.action.toString(),
              });
            }
          }

          const ws = xlsx.utils.json_to_sheet(allRecords);
          const wb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(wb, ws, "Responses");
          xlsx.writeFile(
            wb,
            "./public/" + CATEGORY_IMPORT_FOLDER + "/ack_" + filename
          );
          const path1 = `${process.env.IMAGE_LOCAL_PATH}${CATEGORY_IMPORT_FOLDER}/ack_${filename}`;

          return res.json(
            responseData("PLEASE_DOWNLOAD_CSV_TO_SEE_REPORTS", path1, req, true)
          );
        }
      }
    } catch (error) {
      console.log(error);
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
