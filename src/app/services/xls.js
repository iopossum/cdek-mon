import xlsx from 'xlsx';
import FileSaver from 'file-saver';

class Xls {
  constructor() {

  }

  readCities(data) {
    var workbook = xlsx.read(data, {type: 'binary'});
    var items = xlsx.utils.sheet_to_row_object_array(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
    var array = [];
    items.forEach(function (item) {
      if (item[0] && item[1] || item[3]) {
        array.push({from: item[0] || '', to: item[1] || '', countryFrom: item[2] || '', countryTo: item[3] || ''});
      }
    });
    return array;
  }

  download(name, table) {
    var wopts = { bookType:'xlsx', bookSST:false, type:'binary' };
    var workbook = xlsx.utils.table_to_book(table);

    var wbout = xlsx.write(workbook, wopts);

    function s2ab(s) {
      var buf = new ArrayBuffer(s.length);
      var view = new Uint8Array(buf);
      for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }

    /* the saveAs call downloads a file on the local machine */
    FileSaver.saveAs(new Blob([s2ab(wbout)],{type:"application/octet-stream"}), name);
  }

}

export default Xls;
