import { list, countries } from './helpers/delivery';


module.exports = function (req, res) {
  return res.json({
    deliveries: list(),
    countries: countries()
  });
};