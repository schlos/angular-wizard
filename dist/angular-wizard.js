/**
 * Easy to use Wizard library for AngularJS
 * @version v0.3.0 - 2014-04-03 * @link https://github.com/mgonto/angular-wizard
 * @author Martin Gontovnikas <martin@gon.to>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module('templates-angularwizard', ['step.html', 'wizard.html']);

angular.module("step.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("step.html",
    "<section ng-show=\"selected\" ng-class=\"{current: selected, done: completed}\" class=\"step\" ng-transclude>\n" +
    "</section>");
}]);

angular.module("wizard.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("wizard.html",
    "<div>\n" +
    "    <div class=\"steps\" ng-transclude></div>\n" +
    "    <ul class=\"steps-indicator steps-{{steps.length}}\" ng-if=\"!hideIndicators\">\n" +
    "      <li ng-class=\"{default: !step.completed && !step.selected, current: step.selected && !step.completed, done: step.completed && !step.selected, editing: step.selected && step.completed}\" ng-repeat=\"step in steps\">\n" +
    "        <a ng-click=\"goTo(step)\">{{step.title}}</a>\n" +
    "      </li>\n" +
    "    </ul>\n" +
    "</div>");
}]);

angular.module('mgo-angular-wizard', ['templates-angularwizard']);

angular.module('mgo-angular-wizard').directive('wzStep', function() {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        scope: {
            title: '@',
            validateStep: '&'
        },
        require: '^wizard',
        templateUrl: function(element, attributes) {
          return attributes.template || "step.html";
        },
        link: function($scope, $element, $attrs, wizard) {
            // If the validateStep isn't passed, the validate function must return true
            if (_.isUndefined($attrs['validateStep']))
                $scope.validateStep = function() { return true; };
            wizard.addStep($scope);
        }
    }
});

angular.module('mgo-angular-wizard').directive('wizard', function() {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        scope: {
            currentStep: '=',
            onFinish: '&',
            hideIndicators: '=',
            validateOnlyToAdvance: '@',
            editMode: '=',
            name: '@'
        },
        templateUrl: function(element, attributes) {
          return attributes.template || "wizard.html";
        },
        controller: ['$scope', '$element', 'WizardHandler', function($scope, $element, WizardHandler) {

            var validateOnlyToAdvance = _.isUndefined($scope.validateOnlyToAdvance) ? true : $scope.validateOnlyToAdvance === 'true';
            
            WizardHandler.addWizard($scope.name || WizardHandler.defaultName, this);
            $scope.$on('$destroy', function() {
                WizardHandler.removeWizard($scope.name || WizardHandler.defaultName);
            });
            
            $scope.steps = [];
            
            $scope.$watch('currentStep', function(step) {
                if (!step) return;
                
                if ($scope.selectedStep && $scope.selectedStep.title !== $scope.currentStep) {
                    $scope.goTo(_.find($scope.steps, {title: $scope.currentStep}));
                }
                
            });
            
            $scope.$watch('[editMode, steps.length]', function() {
                var editMode = $scope.editMode;
                if (_.isUndefined(editMode) || _.isNull(editMode)) return;
                
                if (editMode) {
                    _.each($scope.steps, function(step) {
                        step.completed = true;
                    });
                }
            }, true);
            
            this.addStep = function(step) {
                $scope.steps.push(step);
                if ($scope.steps.length === 1) {
                    $scope.goTo($scope.steps[0]);
                }
            };
            
            $scope.goTo = function(step) {
                if (!$scope.validateGoTo(step)) return;
                unselectAll();
                $scope.selectedStep = step;
                if (!_.isUndefined($scope.currentStep)) {
                    $scope.currentStep = step.title;
                }
                step.selected = true;
            };

            $scope.validateGoTo = function(nextStep) {
                var indexNextStep = _.indexOf($scope.steps , nextStep);
                var indexCurrentStep = _.indexOf($scope.steps, $scope.selectedStep);
                if (indexNextStep == -1 || indexCurrentStep == -1) {
                    // if the next step is invalid, it won't change the step
                    // if the current step is invalid, there is nothing to validate.
                    return true;
                }
                if (validateOnlyToAdvance && indexNextStep < indexCurrentStep)
                    return true;
                else
                    return $scope.selectedStep.validateStep();
            };
            
            function unselectAll() {
                _.each($scope.steps, function (step) {
                    step.selected = false;
                });
                $scope.selectedStep = null;
            }
            
            this.next = function(draft) {
                var index = _.indexOf($scope.steps , $scope.selectedStep);
                if (!draft) {
                    $scope.selectedStep.completed = true;
                }
                if (index === $scope.steps.length - 1) {
                    this.finish();
                } else {
                    $scope.goTo($scope.steps[index + 1]);
                }
            };
            
            this.goTo = function(step) {
                var stepTo;
                if (_.isNumber(step)) {
                    stepTo = $scope.steps[step];
                } else {
                    stepTo = _.find($scope.steps, {title: step});
                }
                $scope.goTo(stepTo);
            };
            
            this.finish = function() {
                $scope.onFinish && $scope.onFinish(); 
            };
            
            this.cancel = this.previous = function() {
                var index = _.indexOf($scope.steps , $scope.selectedStep);
                if (index === 0) {
                    throw new Error("Can't go back. It's already in step 0");
                } else {
                    $scope.goTo($scope.steps[index - 1]);
                }
            }
            
            
        }]
    }
});

function wizardButtonDirective(action) {
    angular.module('mgo-angular-wizard')
        .directive(action, function() {
            return {
                restrict: 'A',
                replace: false,
                require: '^wizard',
                link: function($scope, $element, $attrs, wizard) {
                    
                    $element.on("click", function(e) {
                        e.preventDefault();
                        $scope.$apply(function() {
                            $scope.$eval($attrs[action]);
                            wizard[action.replace("wz", "").toLowerCase()]();
                        });
                    });
                }
            }
            });
}

wizardButtonDirective('wzNext');
wizardButtonDirective('wzPrevious');
wizardButtonDirective('wzFinish');
wizardButtonDirective('wzCancel');

angular.module('mgo-angular-wizard').factory('WizardHandler', function() {
   var service = {};
   
   var wizards = {};
   
   service.defaultName = "defaultWizard";
   
   service.addWizard = function(name, wizard) {
       wizards[name] = wizard;
   };
   
   service.removeWizard = function(name) {
       delete wizards[name];
   };
   
   service.wizard = function(name) {
       var nameToUse = name;
       if (!name) {
           nameToUse = service.defaultName;
       }
       
       return wizards[nameToUse];
   };
   
   return service;
});
