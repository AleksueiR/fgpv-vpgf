// GLOBAL VENDOR IMPORTS
import 'jquery';
import 'angular';
import 'angular-aria';
import 'angular-animate';
import '../material/angular-material.min.js';
import 'angular-messages';
import 'angular-sanitize';
import 'angular-translate';
import 'dotjem-angular-tree/src/directives/dxTree.js';
import 'angular-translate-loader-static-files';
import 'datatables.net';
import 'datatables.net-buttons';
import 'datatables.net-buttons/js/buttons.html5.js';
import 'datatables.net-buttons/js/buttons.print.js';
import 'datatables.net-colreorder';
import 'datatables.net-scroller';
import 'datatables.net-select';
import html2canvas from 'html2canvas';

window.html2canvas = html2canvas;

console.log('html2canvas', html2canvas);

// APPLICATION MAIN IMPORTS
import './api-loader';
import './app-seed';
import './bootstrap';
import './global-registry.js';
import './geo/geo.module.js';
import './core/core.module.js';
import './layout/layout.module.js';
import './ui/ui.module.js';
import './ui/ui-loader.js';
import './core/core-loader.js';
import './geo/geo-loader.js';
import './layout/layout-loader.js';
import './app.module.js';
import './focus-manager.js';
import '../plugins/core/back-to-cart.js';
import '../plugins/core/coord-info.js';
import '../plugins/core/area-of-interest.js';
import '../content/styles/main.scss';
import './ui/fancyHover';
