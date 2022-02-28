import { Component, Output, EventEmitter, Input } from '@angular/core';
import { AbstractAlertableComponent } from 'src/app/lib/core/helpers/component-interfaces';
import { AppUIStoreManager } from 'src/app/lib/core/helpers/app-ui-store-manager.service';
import { ClrDatagridStateInterface } from '@clr/angular';
import { RoleV2 } from '../../../../../../core/auth/contracts/v2/authorizations/role';

@Component({
  selector: 'app-role-list-presenter',
  templateUrl: './role-list-presenter.component.html',
  styles: []
})
export class RoleListPresenterComponent extends AbstractAlertableComponent {

  @Input() items: RoleV2[] = [];
  @Input() showDgActions = true;
  @Input() showStatus = true;
  @Input() showLoader = false;
  @Input() total = false;
  @Output() selectItemEvent = new EventEmitter<RoleV2>();
  @Output() refresh = new EventEmitter<ClrDatagridStateInterface>();
  @Output() navigateToCreateView = new EventEmitter();
  @Output() dgRefresh = new EventEmitter();
  @Input() showDgHeader = false;

  constructor(uiStore: AppUIStoreManager) { super(uiStore); }

  navigateToCreateFormView() {
    this.navigateToCreateView.emit();
  }

  onDgHeaderRefresh() {
    this.dgRefresh.emit();
  }

}
