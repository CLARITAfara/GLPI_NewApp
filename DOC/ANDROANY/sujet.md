port.RepositoryMethodInvoker$RepositoryFragmentMethodInvoker.lambda$new$0(RepositoryMethodInvoker.java:278) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryMethodInvoker.doInvoke(RepositoryMethodInvoker.java:169) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryMethodInvoker.invoke(RepositoryMethodInvoker.java:158) ~[spring-data-commons-4.0.5.jar:4.0.5]  
        at org.springframework.data.repository.core.support.RepositoryComposition$RepositoryFragments.invoke(RepositoryComposition.java:545) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryComposition.invoke(RepositoryComposition.java:290) ~[spring-data-commons-4.0.5.jar:4.0.5]      
        at org.springframework.data.repository.core.support.RepositoryFactorySupport$ImplementationMethodExecutionInterceptor.invoke(RepositoryFactorySupport.java:690) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.repository.core.support.QueryExecutorMethodInterceptor.doInvoke(QueryExecutorMethodInterceptor.java:171) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.QueryExecutorMethodInterceptor.invoke(QueryExecutorMethodInterceptor.java:146) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.projection.DefaultMethodInvokingMethodInterceptor.invoke(DefaultMethodInvokingMethodInterceptor.java:69) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.transaction.interceptor.TransactionInterceptor$1.proceedWithInvocation(TransactionInterceptor.java:133) ~[spring-tx-7.0.7.jar:7.0.7]  
        at org.springframework.transaction.interceptor.TransactionAspectSupport.invokeWithinTransaction(TransactionAspectSupport.java:371) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.transaction.interceptor.TransactionInterceptor.invoke(TransactionInterceptor.java:130) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.dao.support.PersistenceExceptionTranslationInterceptor.invoke(PersistenceExceptionTranslationInterceptor.java:135) ~[spring-tx-7.0.7.jar:7.0.7]
        ... 26 common frames omitted
Caused by: org.sqlite.SQLiteException: [SQLITE_ERROR] SQL error or missing database (no such column: tce1_0.annule)
        at org.sqlite.core.DB.newSQLException(DB.java:1179) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.newSQLException(DB.java:1190) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.throwex(DB.java:1150) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.NativeDB.prepare_utf8(Native Method) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.NativeDB.prepare(NativeDB.java:135) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.prepare(DB.java:264) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.CorePreparedStatement.<init>(CorePreparedStatement.java:46) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc3.JDBC3PreparedStatement.<init>(JDBC3PreparedStatement.java:32) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc4.JDBC4PreparedStatement.<init>(JDBC4PreparedStatement.java:25) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc4.JDBC4Connection.prepareStatement(JDBC4Connection.java:34) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc3.JDBC3Connection.prepareStatement(JDBC3Connection.java:225) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at com.zaxxer.hikari.pool.ProxyConnection.prepareStatement(ProxyConnection.java:342) ~[HikariCP-7.0.2.jar:na]
        at com.zaxxer.hikari.pool.HikariProxyConnection.prepareStatement(HikariProxyConnection.java) ~[HikariCP-7.0.2.jar:na]
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl$4.doPrepare(StatementPreparerImpl.java:155) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]      
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl$StatementPreparationTemplate.prepareStatement(StatementPreparerImpl.java:183) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        ... 66 common frames omitted

2026-06-22T17:50:36.514+03:00  INFO 23504 --- [newapp] [           main] o.s.boot.tomcat.GracefulShutdown         : Commencing graceful shutdown. Waiting for active requests to complete
2026-06-22T17:50:36.933+03:00  INFO 23504 --- [newapp] [tomcat-shutdown] o.s.boot.tomcat.GracefulShutdown         : Graceful shutdown complete
2026-06-22T17:50:36.938+03:00  INFO 23504 --- [newapp] [           main] j.LocalContainerEntityManagerFactoryBean : Closing JPA EntityManagerFactory for persistence unit 'default'
2026-06-22T17:50:36.941+03:00  INFO 23504 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown initiated...
2026-06-22T17:50:36.955+03:00  INFO 23504 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown completed.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  22.188 s
[INFO] Finished at: 2026-06-22T17:50:37+03:00
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.springframework.boot:spring-boot-maven-plugin:4.0.6:run (default-cli) on project newapp: Process terminated with exit code: 1 -> [Help 1]
[ERROR]
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR]
[ERROR] For more information about the errors and possible solutions, please read the following articles:     
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoExecutionException
PS C:\xampp\htdocs\glpi\GLPI_NewApp\newapp> mvn spring-boot:run
[INFO] Scanning for projects...
[INFO] 
[INFO] --------------------------< com.glpi:newapp >---------------------------
[INFO] Building newapp 0.0.1-SNAPSHOT
[INFO]   from pom.xml
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] >>> spring-boot:4.0.6:run (default-cli) > test-compile @ newapp >>>
[INFO] 
[INFO] --- resources:3.3.1:resources (default-resources) @ newapp ---
[INFO] Copying 1 resource from src\main\resources to target\classes
[INFO] Copying 2 resources from src\main\resources to target\classes
[INFO]
[INFO] --- compiler:3.14.1:compile (default-compile) @ newapp ---
[INFO] Nothing to compile - all classes are up to date.
[INFO]
[INFO] --- resources:3.3.1:testResources (default-testResources) @ newapp ---
[INFO] skip non existing resourceDirectory C:\xampp\htdocs\glpi\GLPI_NewApp\newapp\src\test\resources
[INFO]
[INFO] --- compiler:3.14.1:testCompile (default-testCompile) @ newapp ---
[INFO] Nothing to compile - all classes are up to date.
[INFO]
[INFO] <<< spring-boot:4.0.6:run (default-cli) < test-compile @ newapp <<<
[INFO]
[INFO]
[INFO] --- spring-boot:4.0.6:run (default-cli) @ newapp ---
[INFO] Attaching agents: []

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/

 :: Spring Boot ::                (v4.0.6)

2026-06-22T17:51:18.712+03:00  INFO 17232 --- [newapp] [           main] com.glpi.newapp.NewappApplication        : Starting NewappApplication using Java 17.0.18 with PID 17232 (C:\xampp\htdocs\glpi\GLPI_NewApp\newapp\target\classes started by clari in C:\xampp\htdocs\glpi\GLPI_NewApp\newapp)
2026-06-22T17:51:18.717+03:00  INFO 17232 --- [newapp] [           main] com.glpi.newapp.NewappApplication        : No active profile set, falling back to 1 default profile: "default"
2026-06-22T17:51:19.771+03:00  INFO 17232 --- [newapp] [           main] .s.d.r.c.RepositoryConfigurationDelegate : Bootstrapping Spring Data JPA repositories in DEFAULT mode.
2026-06-22T17:51:19.875+03:00  INFO 17232 --- [newapp] [           main] .s.d.r.c.RepositoryConfigurationDelegate : Finished Spring Data repository scanning in 92 ms. Found 8 JPA repository interfaces.
2026-06-22T17:51:20.657+03:00  INFO 17232 --- [newapp] [           main] o.s.boot.tomcat.TomcatWebServer          : Tomcat initialized with port 8080 (http)
2026-06-22T17:51:20.684+03:00  INFO 17232 --- [newapp] [           main] o.apache.catalina.core.StandardService   : Starting service [Tomcat]
2026-06-22T17:51:20.685+03:00  INFO 17232 --- [newapp] [           main] o.apache.catalina.core.StandardEngine    : Starting Servlet engine: [Apache Tomcat/11.0.21] 
2026-06-22T17:51:20.802+03:00  INFO 17232 --- [newapp] [           main] b.w.c.s.WebApplicationContextInitializer : Root WebApplicationContext: initialization completed in 1975 ms
2026-06-22T17:51:20.959+03:00  INFO 17232 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Starting...
2026-06-22T17:51:21.323+03:00  INFO 17232 --- [newapp] [           main] com.zaxxer.hikari.pool.HikariPool        : HikariPool-1 - Added connection org.sqlite.jdbc4.JDBC4Connection@23ed382c
2026-06-22T17:51:21.326+03:00  INFO 17232 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Start completed.
2026-06-22T17:51:21.499+03:00  INFO 17232 --- [newapp] [           main] org.hibernate.orm.jpa                
    : HHH008540: Processing PersistenceUnitInfo [name: default]
2026-06-22T17:51:21.672+03:00  INFO 17232 --- [newapp] [           main] org.hibernate.orm.core               
    : HHH000001: Hibernate ORM core version 7.2.12.Final
2026-06-22T17:51:22.443+03:00  INFO 17232 --- [newapp] [           main] o.s.o.j.p.SpringPersistenceUnitInfo      : No LoadTimeWeaver setup: ignoring JPA class transformer
2026-06-22T17:51:22.553+03:00  INFO 17232 --- [newapp] [           main] org.hibernate.orm.connections.pooling    : HHH10001005: Database info:
        Database JDBC URL [jdbc:sqlite:newapp.db]      
        Database driver: SQLite JDBC
        Database dialect: SQLiteDialect
        Database version: 3.50.1
        Default catalog/schema: undefined/undefined    
        Autocommit mode: undefined/unknown
        Isolation level: SERIALIZABLE [default SERIALIZABLE]
        JDBC fetch size: none
        Pool: DataSourceConnectionProvider
        Minimum pool size: undefined/unknown
        Maximum pool size: undefined/unknown
2026-06-22T17:51:24.048+03:00  INFO 17232 --- [newapp] [           main] org.hibernate.orm.core               
    : HHH000489: No JTA platform available (set 'hibernate.transaction.jta.platform' to enable JTA platform integration)
2026-06-22T17:51:24.059+03:00  INFO 17232 --- [newapp] [           main] j.LocalContainerEntityManagerFactoryBean : Initialized JPA EntityManagerFactory for persistence unit 'default'
2026-06-22T17:51:24.203+03:00  INFO 17232 --- [newapp] [           main] o.s.d.j.r.query.QueryEnhancerFactories   : Hibernate is in classpath; If applicable, HQL parser will be used.
2026-06-22T17:51:24.728+03:00  WARN 17232 --- [newapp] [           main] JpaBaseConfiguration$JpaWebConfiguration : spring.jpa.open-in-view is enabled by default. Therefore, database queries may be performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable this warning
2026-06-22T17:51:25.233+03:00  INFO 17232 --- [newapp] [           main] o.s.boot.tomcat.TomcatWebServer          : Tomcat started on port 8080 (http) with context path '/'
2026-06-22T17:51:25.240+03:00  INFO 17232 --- [newapp] [           main] com.glpi.newapp.NewappApplication        : Started NewappApplication in 7.273 seconds (process running for 7.999)
Hibernate: 
    select
        tce1_0.id,
        tce1_0.annule,
        tce1_0.created_at,
        tce1_0.mode_calcul,
        tce1_0.montant,
        tce1_0.ordre,
        tce1_0.pourcentage,
        tce1_0.ticket_id,
        tce1_0.type
    from
        ticket_cost_events tce1_0
2026-06-22T17:51:25.521+03:00  WARN 17232 --- [newapp] [           main] org.hibernate.orm.jdbc.error         
    : HHH000247: ErrorCode: 1, SQLState: null
2026-06-22T17:51:25.521+03:00  WARN 17232 --- [newapp] [           main] org.hibernate.orm.jdbc.error         
    : [SQLITE_ERROR] SQL error or missing database (no such column: tce1_0.annule)
2026-06-22T17:51:25.562+03:00  INFO 17232 --- [newapp] [           main] .s.b.a.l.ConditionEvaluationReportLogger :

Error starting ApplicationContext. To display the condition evaluation report re-run your application with 'debug' enabled.
2026-06-22T17:51:25.592+03:00 ERROR 17232 --- [newapp] [           main] o.s.boot.SpringApplication           
    : Application run failed

org.springframework.orm.jpa.JpaSystemException: Could not prepare statement [[SQLITE_ERROR] SQL error or missing database (no such column: tce1_0.annule)] [select tce1_0.id,tce1_0.annule,tce1_0.created_at,tce1_0.mode_calcul,tce1_0.montant,tce1_0.ordre,tce1_0.pourcentage,tce1_0.ticket_id,tce1_0.type from ticket_cost_events tce1_0]
        at org.springframework.orm.jpa.hibernate.HibernateExceptionTranslator.convertHibernateAccessException(HibernateExceptionTranslator.java:223) ~[spring-orm-7.0.7.jar:7.0.7]
        at org.springframework.orm.jpa.hibernate.HibernateExceptionTranslator.convertHibernateAccessException(HibernateExceptionTranslator.java:131) ~[spring-orm-7.0.7.jar:7.0.7]
        at org.springframework.orm.jpa.hibernate.HibernateExceptionTranslator.translateExceptionIfPossible(HibernateExceptionTranslator.java:105) ~[spring-orm-7.0.7.jar:7.0.7]
        at org.springframework.orm.jpa.vendor.HibernateJpaDialect.translateExceptionIfPossible(HibernateJpaDialect.java:223) ~[spring-orm-7.0.7.jar:7.0.7]
        at org.springframework.orm.jpa.AbstractEntityManagerFactoryBean.translateExceptionIfPossible(AbstractEntityManagerFactoryBean.java:576) ~[spring-orm-7.0.7.jar:7.0.7]
        at org.springframework.dao.support.ChainedPersistenceExceptionTranslator.translateExceptionIfPossible(ChainedPersistenceExceptionTranslator.java:61) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.dao.support.DataAccessUtils.translateIfNecessary(DataAccessUtils.java:346) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.dao.support.PersistenceExceptionTranslationInterceptor.invoke(PersistenceExceptionTranslationInterceptor.java:157) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.jpa.repository.support.CrudMethodMetadataPostProcessor$CrudMethodMetadataPopulatingMethodInterceptor.invoke(CrudMethodMetadataPostProcessor.java:166) ~[spring-data-jpa-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.aop.framework.JdkDynamicAopProxy.invoke(JdkDynamicAopProxy.java:222) ~[spring-aop-7.0.7.jar:7.0.7]
        at jdk.proxy2/jdk.proxy2.$Proxy139.findAll(Unknown Source) ~[na:na]
        at com.glpi.newapp.service.RebuildFixedCostsRunner.run(RebuildFixedCostsRunner.java:29) ~[classes/:na]
        at org.springframework.boot.SpringApplication.lambda$callRunner$0(SpringApplication.java:788) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.util.function.ThrowingConsumer$1.acceptWithException(ThrowingConsumer.java:82) ~[spring-core-7.0.7.jar:7.0.7]
        at org.springframework.util.function.ThrowingConsumer.accept(ThrowingConsumer.java:60) ~[spring-core-7.0.7.jar:7.0.7]
        at org.springframework.util.function.ThrowingConsumer$1.accept(ThrowingConsumer.java:86) ~[spring-core-7.0.7.jar:7.0.7]
        at org.springframework.boot.SpringApplication.callRunner(SpringApplication.java:800) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.boot.SpringApplication.callRunner(SpringApplication.java:788) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.boot.SpringApplication.lambda$callRunners$0(SpringApplication.java:776) ~[spring-boot-4.0.6.jar:4.0.6]
        at java.base/java.util.stream.ForEachOps$ForEachOp$OfRef.accept(ForEachOps.java:183) ~[na:na]
        at java.base/java.util.stream.SortedOps$SizedRefSortingSink.end(SortedOps.java:357) ~[na:na]
        at java.base/java.util.stream.AbstractPipeline.copyInto(AbstractPipeline.java:510) ~[na:na]
        at java.base/java.util.stream.AbstractPipeline.wrapAndCopyInto(AbstractPipeline.java:499) ~[na:na]    
        at java.base/java.util.stream.ForEachOps$ForEachOp.evaluateSequential(ForEachOps.java:150) ~[na:na]   
        at java.base/java.util.stream.ForEachOps$ForEachOp$OfRef.evaluateSequential(ForEachOps.java:173) ~[na:na]
        at java.base/java.util.stream.AbstractPipeline.evaluate(AbstractPipeline.java:234) ~[na:na]
        at java.base/java.util.stream.ReferencePipeline.forEach(ReferencePipeline.java:596) ~[na:na]
        at org.springframework.boot.SpringApplication.callRunners(SpringApplication.java:776) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.boot.SpringApplication.run(SpringApplication.java:328) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.boot.SpringApplication.run(SpringApplication.java:1365) ~[spring-boot-4.0.6.jar:4.0.6]
        at org.springframework.boot.SpringApplication.run(SpringApplication.java:1354) ~[spring-boot-4.0.6.jar:4.0.6]
        at com.glpi.newapp.NewappApplication.main(NewappApplication.java:10) ~[classes/:na]
Caused by: org.hibernate.exception.GenericJDBCException: Could not prepare statement [[SQLITE_ERROR] SQL error or missing database (no such column: tce1_0.annule)] [select tce1_0.id,tce1_0.annule,tce1_0.created_at,tce1_0.mode_calcul,tce1_0.montant,tce1_0.ordre,tce1_0.pourcentage,tce1_0.ticket_id,tce1_0.type from ticket_cost_events tce1_0]
        at org.hibernate.exception.internal.StandardSQLExceptionConverter.convert(StandardSQLExceptionConverter.java:39) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.engine.jdbc.spi.SqlExceptionHelper.convert(SqlExceptionHelper.java:115) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl$StatementPreparationTemplate.prepareStatement(StatementPreparerImpl.java:194) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl.prepareQueryStatement(StatementPreparerImpl.java:157) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.internal.StandardStatementCreator.createStatement(StandardStatementCreator.java:46) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.results.jdbc.internal.DeferredResultSetAccess.executeQuery(DeferredResultSetAccess.java:257) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.results.jdbc.internal.DeferredResultSetAccess.getResultSet(DeferredResultSetAccess.java:190) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.results.jdbc.internal.JdbcValuesResultSetImpl.<init>(JdbcValuesResultSetImpl.java:71) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]   
        at org.hibernate.sql.exec.internal.JdbcSelectExecutorStandardImpl.resolveJdbcValues(JdbcSelectExecutorStandardImpl.java:422) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.internal.JdbcSelectExecutorStandardImpl.resolveJdbcValuesSource(JdbcSelectExecutorStandardImpl.java:349) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.internal.JdbcSelectExecutorStandardImpl.doExecuteQuery(JdbcSelectExecutorStandardImpl.java:143) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.internal.JdbcSelectExecutorStandardImpl.executeQuery(JdbcSelectExecutorStandardImpl.java:100) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.spi.JdbcSelectExecutor.executeQuery(JdbcSelectExecutor.java:63) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.sql.exec.spi.JdbcSelectExecutor.list(JdbcSelectExecutor.java:137) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.sqm.internal.ConcreteSqmSelectQueryPlan.lambda$new$1(ConcreteSqmSelectQueryPlan.java:134) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.sqm.internal.ConcreteSqmSelectQueryPlan.withCacheableSqmInterpretation(ConcreteSqmSelectQueryPlan.java:464) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.sqm.internal.ConcreteSqmSelectQueryPlan.performList(ConcreteSqmSelectQueryPlan.java:392) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.sqm.internal.SqmQueryImpl.doList(SqmQueryImpl.java:374) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.spi.AbstractSelectionQuery.list(AbstractSelectionQuery.java:153) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.hibernate.query.Query.getResultList(Query.java:121) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        at org.springframework.data.jpa.repository.support.SimpleJpaRepository.findAll(SimpleJpaRepository.java:412) ~[spring-data-jpa-4.0.5.jar:4.0.5]
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method) ~[na:na]
        at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:77) ~[na:na]
        at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43) ~[na:na]
        at java.base/java.lang.reflect.Method.invoke(Method.java:569) ~[na:na]
        at org.springframework.aop.support.AopUtils.invokeJoinpointUsingReflection(AopUtils.java:359) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.repository.core.support.RepositoryMethodInvoker$RepositoryFragmentMethodInvoker.lambda$new$0(RepositoryMethodInvoker.java:278) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryMethodInvoker.doInvoke(RepositoryMethodInvoker.java:169) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryMethodInvoker.invoke(RepositoryMethodInvoker.java:158) ~[spring-data-commons-4.0.5.jar:4.0.5]  
        at org.springframework.data.repository.core.support.RepositoryComposition$RepositoryFragments.invoke(RepositoryComposition.java:545) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.RepositoryComposition.invoke(RepositoryComposition.java:290) ~[spring-data-commons-4.0.5.jar:4.0.5]      
        at org.springframework.data.repository.core.support.RepositoryFactorySupport$ImplementationMethodExecutionInterceptor.invoke(RepositoryFactorySupport.java:690) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.repository.core.support.QueryExecutorMethodInterceptor.doInvoke(QueryExecutorMethodInterceptor.java:171) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.data.repository.core.support.QueryExecutorMethodInterceptor.invoke(QueryExecutorMethodInterceptor.java:146) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.data.projection.DefaultMethodInvokingMethodInterceptor.invoke(DefaultMethodInvokingMethodInterceptor.java:69) ~[spring-data-commons-4.0.5.jar:4.0.5]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.transaction.interceptor.TransactionInterceptor$1.proceedWithInvocation(TransactionInterceptor.java:133) ~[spring-tx-7.0.7.jar:7.0.7]  
        at org.springframework.transaction.interceptor.TransactionAspectSupport.invokeWithinTransaction(TransactionAspectSupport.java:371) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.transaction.interceptor.TransactionInterceptor.invoke(TransactionInterceptor.java:130) ~[spring-tx-7.0.7.jar:7.0.7]
        at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:179) ~[spring-aop-7.0.7.jar:7.0.7]
        at org.springframework.dao.support.PersistenceExceptionTranslationInterceptor.invoke(PersistenceExceptionTranslationInterceptor.java:135) ~[spring-tx-7.0.7.jar:7.0.7]
        ... 26 common frames omitted
Caused by: org.sqlite.SQLiteException: [SQLITE_ERROR] SQL error or missing database (no such column: tce1_0.annule)
        at org.sqlite.core.DB.newSQLException(DB.java:1179) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.newSQLException(DB.java:1190) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.throwex(DB.java:1150) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.NativeDB.prepare_utf8(Native Method) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.NativeDB.prepare(NativeDB.java:135) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.DB.prepare(DB.java:264) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.core.CorePreparedStatement.<init>(CorePreparedStatement.java:46) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc3.JDBC3PreparedStatement.<init>(JDBC3PreparedStatement.java:32) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc4.JDBC4PreparedStatement.<init>(JDBC4PreparedStatement.java:25) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc4.JDBC4Connection.prepareStatement(JDBC4Connection.java:34) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at org.sqlite.jdbc3.JDBC3Connection.prepareStatement(JDBC3Connection.java:225) ~[sqlite-jdbc-3.50.1.0.jar:na]
        at com.zaxxer.hikari.pool.ProxyConnection.prepareStatement(ProxyConnection.java:342) ~[HikariCP-7.0.2.jar:na]
        at com.zaxxer.hikari.pool.HikariProxyConnection.prepareStatement(HikariProxyConnection.java) ~[HikariCP-7.0.2.jar:na]
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl$4.doPrepare(StatementPreparerImpl.java:155) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]      
        at org.hibernate.engine.jdbc.internal.StatementPreparerImpl$StatementPreparationTemplate.prepareStatement(StatementPreparerImpl.java:183) ~[hibernate-core-7.2.12.Final.jar:7.2.12.Final]
        ... 66 common frames omitted

2026-06-22T17:51:25.616+03:00  INFO 17232 --- [newapp] [           main] o.s.boot.tomcat.GracefulShutdown         : Commencing graceful shutdown. Waiting for active requests to complete
2026-06-22T17:51:26.073+03:00  INFO 17232 --- [newapp] [tomcat-shutdown] o.s.boot.tomcat.GracefulShutdown         : Graceful shutdown complete
2026-06-22T17:51:26.077+03:00  INFO 17232 --- [newapp] [           main] j.LocalContainerEntityManagerFactoryBean : Closing JPA EntityManagerFactory for persistence unit 'default'
2026-06-22T17:51:26.081+03:00  INFO 17232 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown initiated...
2026-06-22T17:51:26.087+03:00  INFO 17232 --- [newapp] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown completed.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  12.799 s
[INFO] Finished at: 2026-06-22T17:51:26+03:00
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.springframework.boot:spring-boot-maven-plugin:4.0.6:run (default-cli) on project newapp: Process terminated with exit code: 1 -> [Help 1]
[ERROR]
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR]
[ERROR] For more information about the errors and possible solutions, please read the following articles:     
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoExecutionException
PS C:\xampp\htdocs\glpi\GLPI_NewApp\newapp>