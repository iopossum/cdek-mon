let InputFile = () => {
  return {
    require:"ngModel",
    restrict: 'A',
    link: function (scope, element, attrs, ngModel) {
      element.bind('change', function(event){
        var files = event.target.files;
        var file = files[0];

        ngModel.$setViewValue(file);
        scope.$apply();
      });
    }
  }
}

let SortHeader = () => {
  return {
    scope: {
      title: '@',
      name: '@',
      sort: '=',
      accept: '&'
    },
    restrict: 'A',
    template: "<div class='th-inner' ng-click='setSort()' style='cursor: pointer'><span style='margin-right: 5px' ng-bind='title'></span><i ng-if='sort.name === name' class='fa fa-sort-{{sort.direction}}' aria-hidden='true'></i></div>",
    link: function (scope, element, attrs) {
      scope.setSort = function () {
        var newSort = scope.sort.name !== scope.name;
        scope.sort.name = scope.name;
        var direction = 'asc';
        if (newSort) {
          direction = 'desc';
        } else {
          direction = scope.sort.direction === 'asc' ? 'desc' : 'asc';
        }
        scope.sort.direction = direction;
        scope.accept();
      }
    }
  }
}

module.exports = {InputFile, SortHeader};
