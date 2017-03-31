class Notify {
  constructor(toastr) {
    this.toastr = toastr;
    this.SUCCESSFUL = "УСПЕШНО!";
    this.ERROR = "ОШИБКА!";
    this.WARNING = "ПРЕДУПРЕЖДЕНИЕ!";
    this.SUCCESS_SAVED = "СОХРАНЕНО УСПЕШНО";
    this.SUCCESS_DELETED = "УСЕШНО УДАЛЕНО";
    this.SAVE_REQUEST_ERROR = "ОШИБКА СОХРАНЕНИЯ";
    this.REQUEST_ERROR = "ОШИБКА ЗАПРОСА";
    this.ACCESS_DENIED = "ДОСТУП ЗАПРЕЩЕН";
  }

  info(title, body, options) {
    this.toastr.info(body || "", title, options || {});
  }

  success(title, body, options) {
    this.toastr.success(body || "", title, options || {});
  }

  warning(title, body, options) {
    this.toastr.warning(body || "", title, options || {});
  }

  error(err, options) {
    var title = "Ошибка получения данных";
    if (err) {
      switch (err.status) {
        case -1:
          title = 'Не запущен api-сервер';
          break;
        case 404:
          title = 'Неверная конфигурация сервера';
          break;
        case 500:
          title = err.data ? err.data.title : "Ошибка получения данных";
          break;
      }
    }
    this.toastr.error(title, options || {});
  }
}

Notify.$inject = ['toastr'];

export default Notify;
