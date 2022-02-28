import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, Inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { IDynamicForm } from 'src/app/lib/core/components/dynamic-inputs/core';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, map, takeUntil, tap } from 'rxjs/operators';
import { UIStateStatusCode } from 'src/app/lib/core/helpers/app-ui-store-manager.service';
import { DynamicControlParser } from 'src/app/lib/core/helpers/dynamic-control-parser';
import { TypeUtilHelper } from 'src/app/lib/core/helpers/type-utils-helper';
import { defaultPath, adminPath, backendRoutePaths } from 'src/app/lib/views/partials/partials-configs';
import { CustomValidators } from 'src/app/lib/core/validators';
import { isDefined } from 'src/app/lib/core/utils';
import { UsersProvider } from '../../../../../core/auth/core/providers/app-user';
import { combineLatest } from 'rxjs';
import { AppUIStateProvider } from '../../../../../core/helpers/app-ui-store-manager.service';
import { FormHelperService } from 'src/app/lib/core/helpers';
import { createStateful, createSubject } from 'src/app/lib/core/rxjs/helpers';
import { getUserUsingID, userCreatedAction, userUpdatedAction } from '../../../../../core/auth/core/actions/app-users';
import { DrewlabsRessourceServerClient } from 'src/app/lib/core/http/core';
import { Err } from 'src/app/lib/core/utils/logger';
import { environment } from 'src/environments/environment';
import { TranslationService } from '../../../../../core/translator/translator.service';
import { doLog } from '../../../../../core/rxjs/operators/index';
import { AppUser } from 'src/app/lib/core/auth/contracts/v2/user/user';
import { httpServerHost } from 'src/app/lib/core/utils/url/url';

@Component({
  selector: 'app-add-user',
  templateUrl: './add-user.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddUserComponent implements OnInit, OnDestroy {

  public loadCreateDepartmentForm: IDynamicForm;
  public listUserRoutePath: string;
  // tslint:disable-next-line: variable-name
  private _destroy$ = createSubject();

  formTitle$ = createStateful<string>(null);

  // Selected user property definition
  selectedUserID$ = this.route.paramMap.pipe(
    takeUntil(this._destroy$),
    map(params => {
      if (params.has('id')) {
        getUserUsingID(this.users.store$)(
          this.client,
          `${httpServerHost(this.host)}/${this.path}`,
          params.get('id')
        );
      }
      return +params.get('id');
    }),
  );
  // Translations property definitions
  translations$ = this.translate.translate([
    'invalidRequestParams',
    'serverRequestFailed',
    'successfulRequest'
  ]).pipe(
    takeUntil(this._destroy$)
  );

  // Form state definition
  formState$ = combineLatest([
    this.formHelper.formLoaded$.pipe(
      filter((form) => this.typeHelper.isDefined(form.get('createUserFormID')))
    ),
    this.selectedUserID$
  ]).pipe(
    map(([state, selectedUserID]) => {
      let formConfigs: { form: IDynamicForm, formgroup: FormGroup } = {} as any;
      if (state) {
        formConfigs.form = state.get('createUserFormID');
        const formgroup = this.controlParser.buildFormGroupFromDynamicForm(
          state.get('createUserFormID'), !this.typeHelper.isDefined(selectedUserID)
        ) as FormGroup;
        formgroup.setValidators(CustomValidators.Match('password', 'password_confirmation'));
        formConfigs = { ...formConfigs, formgroup };
      }
      return { selectedUserID, ...formConfigs };
    }),
    doLog('Form config state: ')
  );

  state$ = combineLatest([
    this.users.state$.pipe(
      tap(state => {
        if (state.performingAction) {
          this.uiState.startAction();
        } else {
          this.uiState.endAction();
        }
      }),
      distinctUntilChanged()
    ),
    this.formState$,
    this.translations$
  ])
    .pipe(
      map(([state, formState, translations]) => ({
        ...state,
        ...formState,
        translations,
        selectedUserID: +formState.selectedUserID
      })),
      tap(state => {
        if (state.createdUser) {
          this.uiState.endAction(state.translations.successfulRequest, UIStateStatusCode.STATUS_CREATED);
          if (this.typeHelper.isDefined(state.formgroup)) {
            state.formgroup.reset();
          }
          // Makes the createdRole null after the user was notified
          setTimeout(() => {
            userCreatedAction(this.users.store$)(null);
            this.uiState.endAction();
          }, 2000);
        }

        if (state.updateResult === true) {
          this.uiState.endAction(state.translations.successfulRequest, UIStateStatusCode.STATUS_OK);
          // Makes the createdRole null after the user was notified
          setTimeout(() => {
            userUpdatedAction(this.users.store$)(null);
            this.uiState.endAction();
          }, 2000);
        }

        if (state.error && isDefined(state.error.status)) {
          this.uiState.endAction(
            isDefined(state.error.validationErrors) ?
              null : null,
            state.error.status
          ); //
        }
      }),
      doLog('Add user view state')
    );

  constructor(
    private route: ActivatedRoute,
    private controlParser: DynamicControlParser,
    public readonly typeHelper: TypeUtilHelper,
    private users: UsersProvider,
    private uiState: AppUIStateProvider,
    private formHelper: FormHelperService,
    private client: DrewlabsRessourceServerClient,
    private translate: TranslationService,
    @Inject('AUTH_USERS_RESOURCE_PATH') private path: string,
    @Inject('AUTH_SERVER_HOST') private host: string,
  ) {
    this.listUserRoutePath = `/${defaultPath}/${adminPath.managementsRoute}/${adminPath.listUsersRoute}`;
    this.selectedUserID$.pipe(
      takeUntil(this._destroy$))
      .subscribe();
    this.translations$.pipe(
      takeUntil(this._destroy$))
      .subscribe();
  }

  ngOnInit() {
    this.formHelper.suscribe();
    // Triggers form loading event
    this.formHelper.loadForms.next({
      configs: [
        {
          id: environment.forms.users as number,
          label: 'createUserFormID',
        },
      ],
      result: {
        error: (error: any) => {
          Err(error);
          this.uiState.endAction();
        },
        success: () => {
          this.uiState.endAction();
        },
        warnings: (errors: any) => {
          Err(errors);
          this.uiState.endAction();
        }
      }
    });
  }

  onSetFormTitle(user?: AppUser) {
    const title = !this.typeHelper.isDefined(user) ?
      'Ajouter un utilisateur' :
      `Modification du compte de l'utilisateur le compte utiiisateur : ${user.userInfo.firstname} ${user.userInfo.lastname}`;
    this.formTitle$.next(title);
  }

  ngOnDestroy() {
    this._destroy$.next();
  }
}
